**/ This script makes ShellyPlus1 act as a MQTT thermostat
// it will read and publish the following MQTT topics
// /thermostat/temperature/target
// /thermostat/

//        CurrentHeatingCoolingState: switchHeatStatus,
//        TargetHeatingCoolingState: config.name + "/targetState",
//        CurrentTemperature: sensorCurrentTemperature,
//        TargetTemperature: config.name + "/targetTemperature",

if (MQTT.isConnected()) return; // exit if no active MQTT connection
let deviceInfo = Shelly.getDeviceInfo(), targetTemperature=21, targetHeatinCoolingState=true,
    topicTargetTemperature=deviceInfo.id + '/thermostat/targetTemperature',
    topicTargetHeatingCoolingState=deviceInfo.id + '/thermostat/targetHeatingCoolingState',
    topicCurrentHeatingCoolingState=deviceInfo.id + '/thermostat/currrentHeatingCoolingState',
    topicCurrentTemperature=deviceInfo.id + '/thermostat/currentTemperature';
// publishing the initial target values
MQTT.publish(topicTargetHeatingCoolingState, targetHeatingCoolingState, 0, true)
MQTT.publish(topicTargetTemperature, targetTemperature, 0, true)

// detachs the input : we don't need it
Shelly.call("Switch.SetConfig", {
  id: 1,
  config: {
    in_mode: "detached",
  },
});

// First subscribe some topics
MQTT.subscribe(deviceId.id + '/thermostat/targetHeatingCoolingState', function (message) {
  targetHeatingCoolingState = message;
  if (typeof message === 'undefined') { // no yet published, publishing it

    }
});
MQTT.subscribe(topicTargetTemperature, function (message) {

});

Shelly.addEventHandler(function (message) {
  if (typeof message.info.event === "undefined") return;
  
  //report temperature
  if (message.info.component === "temperature:0") { 
    if (typeof message.info.temperature !== "undefined") {
      MQTT.publish(deviceInfo.id + '/thermostat/currentTemperature', message.info.temperature.tC, 0, true)
    }
  }
  // report currentheatingCoolingState
  if (message.info.component === "switch:0") { 
    if (typeof message.info.state !== "undefined") {
      MQTT.publish(deviceInfo.id + '/thermostat/currentState', message.info.state, 0, true)
    }
  }
}
);

