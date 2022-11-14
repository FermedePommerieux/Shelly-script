// This script makes ShellyPlus1 act as an MQTT heat-only thermostat
// it will read and publish the following MQTT topics


//        CurrentHeatingCoolingState: switchHeatStatus,
//        TargetHeatingCoolingState: config.name + "/targetState",
//        CurrentTemperature: sensorCurrentTemperature,
//        TargetTemperature: config.name + "/targetTemperature",

// for now this script simply crash the device !

if (MQTT.isConnected()) die('No MQTT connection !!!'); // exit if no active MQTT connection
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
    topicThermostat=deviceInfo.id + '/thermostat',
    mqttTargetObj={
	'targetTemperature': targetTemperature,
    	'targetHeatingCoolingState': targetHeatingCoolingState ? "HEAT" : "OFF",
    	'heatingThresholdTemperature': heatingThresholdTemperature,
   	'coolingThresholdTemperature': coolingThresholdTemperature
    },
    mqttCurrentObj={
    	'currrentHeatingCoolingState': currentHeatingCoolingState ? "HEAT" : "OFF",
    	'currentTemperature': currentTemperature
    };

// publish the initial target and current values
MQTT.publish(topicThermostat, JSON.stringify(mqttTargetObj), 0, true);
MQTT.publish(topicThermostat, JSON.stringify(mqttCurrentObj), 0, true);

// Subscribe to target data
MQTT.subscribe(topicThermostat, function (message) {
  if (typeof message === 'undefined') return;
	mqttTargetObj = JSON.parse(message);
});


// Now create the status functions

Shelly.addStatusHandler(function (message) {
  if (typeof message.component === "undefined") return; 
  //report current temperature 
  if (message.info.component === "temperature:0") {
	  if (typeof message.tC !== "undefined") {
		  currentTemperature = message.tC;
	}
  }
  // report currentheatingCoolingState
  if (message.info.component === "switch:0") {
	  if (typeof message.state !== "undefined") {
		currentHeatingCoolingState = message.state;
	}
  }

	//publish
MQTT.publish(topicThermostat, JSON.stringify(mqttCurrentObj), 0, true);
	
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
