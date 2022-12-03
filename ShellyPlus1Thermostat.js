 // This script makes ShellyPlus1 act as an MQTT heat-only thermostat
// it will read and publish the following MQTT topics


//        CurrentHeatingCoolingState: switchHeatStatus,
//        TargetHeatingCoolingState: config.name + "/targetState",
//        CurrentTemperature: sensorCurrentTemperature,
//        TargetTemperature: config.name + "/targetTemperature",


print("Starting Shelly Thermostat Script");

if (!MQTT.isConnected()) die('No MQTT connection !'); // exit if no active MQTT connection
// detach the input : we don't need it
Shelly.call("Switch.SetConfig", {
  id: 0,
  config: {
    in_mode: "detached",
  },
});


// define initial values
let publishMsg=false, d=null, lastStart=null, lastStop=null, useExternalSensor=true,
    minHeatingTime=10*60*1000, holdTimer=false, timer_handle=null, maxTargetTemperature=24,
    topicExternalSensor = 'shellyplusht-c049ef8e1ddc/events/rpc',
    targetTemperature=20, targetHeatingCoolingState="HEAT",
    currentTemperature=targetTemperature,
    currentHeatingCoolingState=targetHeatingCoolingState,
    heatingThresholdTemperature=0.5, coolingThresholdTemperature=1,
    topicThermostat=Shelly.getDeviceInfo().id + '/thermostat',
    KVS_KEY = "thermostat", KVSTObj = null;

// Define some functions


function saveData() {
print("Saving target Data to KVS", KVS_KEY);
	KVSTObj = {
	'targetTemperature': targetTemperature,
    'targetHeatingCoolingState': targetHeatingCoolingState,
    'heatingThresholdTemperature': heatingThresholdTemperature,
   	'coolingThresholdTemperature': coolingThresholdTemperature,
   	'minHeatingTime': minHeatingTime,
    },
  	Shelly.call("KVS.Set", { key: KVS_KEY, value: KVSTObj });
}

function getData() {
  print("Reading from ", KVS_KEY);
  Shelly.call(
    "KVS.Get",
    {
      key: KVS_KEY,
    },
    function (result, error_code, error_message) {
      print("Read from KVS", JSON.stringify(error_code));
      //targetTemperature exist
      if (error_code === 0) {
      	print("Restored target settings :", JSON.stringify(result.value));
      	result = result.value;
      	targetTemperature = result.targetTemperature;
      	targetHeatingCoolingState = result.targetHeatingCoolingState;
      	heatingThresholdTemperature = result.heatingThresholdTemperature;
      	coolingThresholdTemperature = result.coolingThresholdTemperature;
      	minHeatingTime = result.minHeatingTime;
      	return;
      }
    }
  );
}

function publishTarget() {
MQTT.publish(topicThermostat + '/targetTemperature',
 JSON.stringify(targetTemperature), 0, false);
MQTT.publish(topicThermostat + '/targetHeatingCoolingState',
 targetHeatingCoolingState, 0, false);
MQTT.publish(topicThermostat + '/heatingThresholdTemperature',
 JSON.stringify(heatingThresholdTemperature), 0, false);
MQTT.publish(topicThermostat + '/coolingThresholdTemperature',
 JSON.stringify(coolingThresholdTemperature), 0, false);
}

function publishCurrent() {
MQTT.publish(topicThermostat + '/currentHeatingCoolingState',
 JSON.stringify(currentHeatingCoolingState), 0, false);
MQTT.publish(topicThermostat + '/currentTemperature',
 JSON.stringify(currentTemperature) , 0, false);
}

function holdStopHeater() {
print("Timer resumed");
holdTimer = false; heatControl();
};

function heatControl () {
  if (targetHeatingCoolingState === "HEAT") {
    if (currentTemperature < targetTemperature - coolingThresholdTemperature) {
      print("CurrentTemperature is lower than ",targetTemperature - coolingThresholdTemperature, ", starting heater");
      currentHeatingCoolingState = "HEAT";
      Shelly.call("Switch.Set", {'id': 0,'on': true}); // start heater
      //Start timer for minHeatTime
      if (holdTimer === false) { // to not start multiples Timers
      	holdTimer=true; // prevent to stop before a specified time
      print("Starting timer for", minHeatingTime, "ms" );
      	timer_handle = Timer.set(minHeatingTime,true,holdStopHeater);
      }
    }
    else if (currentTemperature > targetTemperature + heatingThresholdTemperature) {
      print("CurrentTemperature is higher than", targetTemperature + heatingThresholdTemperature,", stoping heater");
      if (( holdTimer )&&( currentTemperature < maxTargetTemperature)) {
      	print("minHeatTime not reached, waiting until timer resumes");
      	}
      else {
      	currentHeatingCoolingState = "OFF"; Timer.clear(timer_handle);
      	Shelly.call("Switch.Set", {'id': 0,'on': false}); // stop heater}
    	}
    }
  }
  else {
    print("TargetHeatingCoolingState is set to OFF, stopping heater");
    currentHeatingCoolingState = "OFF"; Timer.clear(timer_handle);
    Shelly.call("Switch.Set", {'id': 0,'on': false}); // stop heater
  }
  publishCurrent();
  };

// publish the initial target and current values
getData(); // restore previous datas
publishTarget();
publishCurrent();

//lauch timer for publishing
Timer.set(50000,true,publishTarget);


// Subscribe to target datas:
MQTT.subscribe(topicThermostat + '/targetTemperature',
 function (topic, message) {
  if (typeof message === "undefined") return;
  message = JSON.parse(message);
  if (targetTemperature === message ) return; 
  targetTemperature = message;
  saveData();
  heatControl();
});
MQTT.subscribe(topicThermostat + '/targetHeatingCoolingState',
 function (topic, message) {
  if (typeof message === "undefined") return;
  if (targetHeatingCoolingState === message ) return;
  targetHeatingCoolingState = JSON.parse(message);
  saveData();
  heatControl();
});
MQTT.subscribe(topicThermostat + '/heatingThresholdTemperature',
 function (topic, message) {
  if (typeof message === "undefined") return;
  message = JSON.parse(message);
  if (heatingThresholdTemperature === message ) return;
  heatingThresholdTemperature = message;
  saveData();
  heatControl();
});
MQTT.subscribe(topicThermostat + '/coolingThresholdTemperature',
 function (topic, message) {
  if (typeof message === "undefined") return;
  message = JSON.parse(message);
  if (coolingThresholdTemperature === message ) return;
  coolingThresholdTemperature = message;
  saveData();
  heatControl();
});

  //Subscribe to an external Sensor if needed
if (useExternalSensor) {
print("External Temperature Sensor enable")
  MQTT.subscribe(topicExternalSensor, function (topic, message) {    
    message = JSON.parse(message);
    if (typeof message.params === "undefined" ) return;
    if ( typeof message.params["temperature:0"] === "undefined" ) return;
    currentTemperature = message.params["temperature:0"].tC;
    print("external temperature sensor has reported a currenTemperature :",
     currentTemperature);
    heatControl();
  });
}

// Now create the status functions

Shelly.addStatusHandler(function (message) {

if (!useExternalSensor) {
  if (typeof message.component === "undefined") return; 
  //report current temperature 
  if ((message.component === "temperature:0")&&(useExternalSensor === false)) {
	  if (typeof message.delta.tC !== "undefined") {
		  currentTemperature = message.delta.tC;
	}
  }
}
  // report currentheatingCoolingState
  if (message.component === "switch:0") {
	  if (typeof message.delta.state !== "undefined") {
		currentHeatingCoolingState = message.delta.state ? "HEAT" : "OFF";
	}
  }

// Now decide to Heat or not to Heat
heatControl();
});
