// This script makes ShellyPlus1 act as an MQTT heat-only thermostat
// it will read and publish the following MQTT topics
// /thermostat/temperature/target
// /thermostat/

//        CurrentHeatingCoolingState: switchHeatStatus,
//        TargetHeatingCoolingState: config.name + "/targetState",
//        CurrentTemperature: sensorCurrentTemperature,
//        TargetTemperature: config.name + "/targetTemperature",

//if (MQTT.isConnected()) die('No MQTT connection !!!'); // exit if no active MQTT connection
// detach the input : we don't need it
Shelly.call("Switch.SetConfig", {
  id: 0,
  config: {
    in_mode: "detached",
  },
});
// define initial values
let deviceInfo = Shelly.getDeviceInfo(), targetTemperature=21, targetHeatingCoolingState=true,
    currentTemperature=targetTemperature, currentHeatingCoolingState=targetHeatingCoolingState,
    heatingThresholdTemperature=0.5, coolingThresholdTemperature=1,
    topicThermostat=deviceInfo.id + '/thermostat', mqttObj={
	'targetTemperature': targetTemperature,
    	'targetHeatingCoolingState': targetHeatingCoolingState ? "HEAT" : "OFF",
    	'currrentHeatingCoolingState': currentHeatingCoolingState ? "HEAT" : "OFF",
    	'currentTemperature': currentTemperature,
    	'heatingThresholdTemperature': heatingThresholdTemperature,
   	'coolingThresholdTemperature': coolingThresholdTemperature
    };

// publish the initial target and current values
MQTT.publish(topicThermostat, JSON.stringify(mqttObj), 0, true);

// Subscribe and create simple target functions
MQTT.subscribe(topicThermostat, function (message) {
  if (typeof message === 'undefined') return;
	mqttObj = JSON.parse(message);
});


// Now create the events functions

Shelly.addEventHandler(function (message) {
  if (typeof message.info.event === "undefined") return; 
  //report current temperature 
  if (message.info.component === "temperature:0") {
	  if (typeof message.info.temperature !== "undefined") {
		  currentTemperature = message.info.temperature.tC;
	}
  }
  // report currentheatingCoolingState
  if (message.info.component === "switch:0") {
	  if (typeof message.info.state !== "undefined") {
		currentHeatingCoolingState = message.info.state;
	}
  }

	//publish
MQTT.publish(topicThermostat, JSON.stringify(mqttObj), 0, true);
	
	// Now decide to Heat or not to Heat
  if (targetHeatingCoolingState) {
	if (currentTemperature < targetTemperature - coolingThresholdTemperature) {
		Shelly.call("Switch.Set", {'id': 0,'on': true}); // start heater
	}
	else if (currentTemperature > targetTemperature + heatingThresholdTemperature) {
		Shelly.call("Switch.Set", {'id': 0,'on': false}); // stop heater
	}
  }

}
);
