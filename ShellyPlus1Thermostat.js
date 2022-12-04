 // This script makes ShellyPlus1 act as an MQTT heat-only thermostat
// it will read and publish the following MQTT topics


/*
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
*/

// define config values, time are in ms and degree in celsius.
let minHeatingTime=10*60*1000, maxTargetTemperature=24,
	minTargetTemperature=16, minThresholdTemperature=0.5,
	targetTemperature=20, targetHeatingCoolingState="HEAT",
	heatingThresholdTemperature=0.5, coolingThresholdTemperature=1,
	useExternalSensor=false, topicExternalSensor='shellyplusht-XXXXXXXXX/events/rpc';


print("Starting Ferme de Pommerieux's ShellyPlus1 Thermostat Script");


// detach the input : we don't need it
Shelly.call("Switch.SetConfig", {
	id: 0,
	config: {
		in_mode: "detached",
	},
});


// define initial values
let loadOnBootTimer=15*1000, publishTargetTimer=5*1000, heatControlTimer=5*1000,
	saveDataTimer=15*60*1000, isRunning=false, dataHasChanged=true,
	controlTimer_handle=null, holdTimer=false, holdTimer_handle=null,
	loadOnBootTimer_handle=null, currentTemperature=targetTemperature,
	currentHeatingCoolingState=Shelly.getComponentStatus('switch:0').output ? "HEAT" : "OFF",
	topicThermostat=Shelly.getDeviceInfo().id + '/thermostat',
	KVS_KEY='thermostat', KVSTObj = null;
	
if (!useExternalSensor) topicExternalSensor =  null;

// Define some functions

function validateTargetData() {
//validate targetTemperature
	if (targetTemperature < minTargetTemperature)
		targetTemperature = minTargetTemperature;
	if (targetTemperature > maxTargetTemperature)
		targetTemperature = maxTargetTemperature;
//validate coolingThresholdTemperature
	if (coolingThresholdTemperature < minThresholdTemperature)
		coolingThresholdTemperature = minThresholdTemperature;
// currentTemperature >=  minTargetTemperature - minThresholdTemperature
	if (targetTemperature - coolingThresholdTemperature <
	minTargetTemperature - minThresholdTemperature)
		coolingThresholdTemperature = targetTemperature - minTargetTemperature;
//validate heatingThresholdTemperature
	if (heatingThresholdTemperature < minThresholdTemperature)
		heatingThresholdTemperature = minThresholdTemperature;
// currentTemperature =<  maxTargetTemperature + minThresholdTemperature
	if (targetTemperature + heatingThresholdTemperature >
	maxTargetTemperature + minThresholdTemperature)
		heatingThresholdTemperature = maxTargetTemperature - targetTemperature;
}

function saveData() {
	if (!dataHasChanged) return;
	print("Saving target Data to KVS", KVS_KEY);
	KVSTObj = {
	'targetTemperature': targetTemperature,
	'targetHeatingCoolingState': targetHeatingCoolingState,
	'heatingThresholdTemperature': heatingThresholdTemperature,
	'coolingThresholdTemperature': coolingThresholdTemperature,
	'minHeatingTime': minHeatingTime,
		},
	Shelly.call("KVS.Set", { key: KVS_KEY, value: KVSTObj });
	dataHasChanged=false;
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
	 JSON.stringify(targetHeatingCoolingState), 0, false);
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
	holdTimer = false;
};

function heatControl() {
	if (dataHasChanged) validateTargetData(); // to validate the target values
	if (targetHeatingCoolingState === "HEAT") {
		if ((currentTemperature < targetTemperature - coolingThresholdTemperature)&&
		(currentHeatingCoolingState !== "HEAT")) { // does nothing if already heating
			print("CurrentTemperature", currentTemperature ," is lower than ",
			targetTemperature - coolingThresholdTemperature, ", starting heater");
			currentHeatingCoolingState = "HEAT";
			Shelly.call("Switch.Set", {'id': 0,'on': true}); // start heater
			//Start timer for minHeatTime
			if (!holdTimer) { // to not start multiples Timers
				holdTimer=true; // prevent to stop before a specified time
				print("Starting timer for", minHeatingTime, "ms" );
				holdTimer_handle = Timer.set(minHeatingTime,true,holdStopHeater);
			}		
		}
		else if ((currentTemperature > targetTemperature + heatingThresholdTemperature)&&
		(currentHeatingCoolingState === "HEAT")) {
			print("CurrentTemperature", currentTemperature ," is higher than",
			 targetTemperature + heatingThresholdTemperature,", stoping heater");
			if (( holdTimer )&&( currentTemperature < maxTargetTemperature)) {
				print("minHeatTime not reached, waiting until timer resumes");
				}
			else {
				currentHeatingCoolingState = "OFF";
				Timer.clear(holdTimer_handle);
				Shelly.call("Switch.Set", {'id': 0,'on': false}); // stop heater}
			}
		}
	}
	else if (currentHeatingCoolingState === "HEAT" ) {
		print("TargetHeatingCoolingState is set to OFF, stopping heater");
		currentHeatingCoolingState = "OFF"; Timer.clear(timer_handle);
		Shelly.call("Switch.Set", {'id': 0,'on': false}); // stop heater
	}
	publishCurrent();
	};

function thermostat () {
//exit if no active MQTT connection or already running
if ((!MQTT.isConnected())||(isRunning)) return;
// ok we are running now, try to clear the loadOnBootTimer to reduce memmory usage
isRunning = true; Timer.clear(loadOnBootTimer_handle);
print('LoadOnBootTimer cleared');
// restore previous datas
getData();

// publish the initial target and current values
publishTarget();
publishCurrent();

//lauch timers for MQTT publish, Data save and heatcontrol
// Note i could merge heatControl and publishTarget if i need another timer
if (publishTargetTimer !== heatControlTimer) {
	Timer.set(publishTargetTimer,true,publishTarget);
	Timer.set(heatControlTimer,true,heatControl);
	}
else { // reducing timers usage
	Timer.set(publishTargetTimer,true,function () {
		publishTarget();
		heatControl();
		});
	}
Timer.set(saveDataTimer,true,saveData);

// Subscribe to target datas:
MQTT.subscribe(topicThermostat + '/targetTemperature',
 function (topic, message) {
	if (typeof message === "undefined") return;
	message = JSON.parse(message);
	if (targetTemperature === message ) return; 
	targetTemperature = message;
	dataHasChanged=true;
});
MQTT.subscribe(topicThermostat + '/targetHeatingCoolingState',
 function (topic, message) {
	if (typeof message === "undefined") return;
	if (targetHeatingCoolingState === message ) return;
	targetHeatingCoolingState = JSON.parse(message);
	dataHasChanged=true;
});
MQTT.subscribe(topicThermostat + '/heatingThresholdTemperature',
 function (topic, message) {
	if (typeof message === "undefined") return;
	message = JSON.parse(message);
	if (heatingThresholdTemperature === message ) return;
	heatingThresholdTemperature = message;
	dataHasChanged=true;
});
MQTT.subscribe(topicThermostat + '/coolingThresholdTemperature',
 function (topic, message) {
	if (typeof message === "undefined") return;
	message = JSON.parse(message);
	if (coolingThresholdTemperature === message ) return;
	coolingThresholdTemperature = message;
	dataHasChanged=true;
});

//Subscribe to an external Sensor if needed
if (useExternalSensor) {
print("External Temperature Sensor enable")
	MQTT.subscribe(topicExternalSensor, function (topic, message) {
		message = JSON.parse(message);
		if (typeof message.params === "undefined" ) return;
		if ( typeof message.params["temperature:0"] === "undefined" ) return;
		currentTemperature = message.params["temperature:0"].tC;
		print("external temperature sensor has reported a currentTemperature :",
		 currentTemperature);
	});
}

// Subscribe to internal sensors

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
});
};

loadOnBootTimer_handle = Timer.set(loadOnBootTimer,true,thermostat);
