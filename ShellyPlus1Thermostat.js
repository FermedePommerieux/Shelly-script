// This script makes ShellyPlus1 act as an MQTT thermostat
// it will read and publish the following MQTT topics
// /thermostat/temperature/target
// /thermostat/

//        CurrentHeatingCoolingState: switchHeatStatus,
//        TargetHeatingCoolingState: config.name + "/targetState",
//        CurrentTemperature: sensorCurrentTemperature,
//        TargetTemperature: config.name + "/targetTemperature",

if (MQTT.isConnected()) die('No MQTT connection !!!'); // exit if no active MQTT connection

// detach the input : we don't need it
Shelly.call("Switch.SetConfig", {
  id: 0,
  config: {
    in_mode: "detached",
  },
});
// define initial values
let deviceInfo = Shelly.getDeviceInfo(), targetTemperature=21, targetHeatinCoolingState=true, currentTemperature=targetTemperature,
    heatingThresholdTemperature=0.5, coolingThresholdTemperature=1,
    topicTargetTemperature=deviceInfo.id + '/thermostat/targetTemperature',
    topicTargetHeatingCoolingState=deviceInfo.id + '/thermostat/targetHeatingCoolingState',
    topicCurrentHeatingCoolingState=deviceInfo.id + '/thermostat/currrentHeatingCoolingState',
    topicCurrentTemperature=deviceInfo.id + '/thermostat/currentTemperature',
    topicHeatingThresholdTemperature=deviceInfo.id + '/thermostat/heatingThresholdTemperature',
    topicCoolingThresholdTemperature=deviceInfo.id + '/thermostat/coolingThresholdTemperature';



// publish the initial target and current values
MQTT.publish(topicTargetHeatingCoolingState, targetHeatingCoolingState, 0, true);
MQTT.publish(topicTargetTemperature, targetTemperature, 0, true);
MQTT.publish(topicHeatingThresholdTemperature, heatingThresholdTemperature, 0, true);
MQTT.publish(topicCoolingThresholdTemperature, coolingThresholdTemperature, 0, true);
MQTT.publish(topicCurrentTemperature, targetTemperature, 0, true);
MQTT.publish(topicCurrentTemperature, currentTemperature, 0, true);


// Subscribe and create simple target functions
MQTT.subscribe(topicTargetHeatingCoolingState, function (message) {
  if (typeof message === 'undefined') return;
  targetHeatingCoolingState = message;
});
MQTT.subscribe(topicTargetTemperature, function (message) {
	if (typeof message === 'undefined') return;
	targetTemperature = message ;
});
MQTT.subscribe(topicHeatingThresholdTemperature, function (message) {
	if (typeof message === 'undefined') return;
	HeatingThresholdTemperature = message ;
});
MQTT.subscribe(topicCoolingThresholdTemperature, function (message) {
  if (typeof message === 'undefined') return;
	coolThresholdTemperature = message ;
});


// Now create the events functions

Shelly.addEventHandler(function (message) {
  if (typeof message.info.event === "undefined") return; 
  //report current temperature 
  if (message.info.component === "temperature:0") {
	  if (typeof message.info.temperature !== "undefined") {
		  MQTT.publish(TopicCurrentTemperature', message.info.temperature.tC, 0, true);
	}
  }
  // report currentheatingCoolingState
  if (message.info.component === "switch:0") {
	  if (typeof message.info.state !== "undefined") {
		  MQTT.publish(TopicCurrentState', message.info.state, 0, true);
	}
  }
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
