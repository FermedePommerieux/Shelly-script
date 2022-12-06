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
 let minHeatingTime = 10 * 60 * 1000,
 	targetTemperature = 20.5,
 	targetHeatingCoolingState = "HEAT",
 	heatingThresholdTemperature = 19,
 	coolingThresholdTemperature = 21,
 	minAllowedTemperature = 16,
 	maxAllowedTemperature = 24,
 	minHysteresisCoolingTemperature = 1,
 	minHysteresisHeatingTemperature = 0.5,
 	useExternalSensor = true,
 	topicExternalSensor = 'shellyplusht-c049ef8e1ddc/events/rpc',
 	restoreData = true; // set to false to use local declared target at startup

 print("Starting Ferme de Pommerieux's ShellyPlus1 Thermostat Script");
 // detach the input : we don't need it
 Shelly.call("Switch.SetConfig", {
 	id: 0,
 	config: {
 		in_mode: "detached",
 	},
 });
 // define initial values
 let loadOnBootTimer = 15 * 1000,
 	publishTargetTimer = 5 * 1000,
 	heatControlTimer = 5 * 1000,
 	saveDataTimer = 15 * 60 * 1000,
 	hysteresisCoolingTemperature = targetTemperature -
 	coolingThresholdTemperature,
 	hysteresisHeatingTemperature = heatingThresholdTemperature -
 	targetTemperature,
 	isRunning = false,
 	dataHasChanged = true,
 	holdTimer = false,
 	controlTimer_handle = null,
 	publishTargetTimer_handle = null,
 	saveDataTimer_handle = null,
 	holdTimer_handle = null,
 	loadOnBootTimer_handle = null,
 	currentTemperature = targetTemperature,
 	currentHeatingCoolingState = Shelly.getComponentStatus('switch:0').output ?
 	"HEAT" : "OFF",
 	topicThermostat = Shelly.getDeviceInfo().id + '/thermostat',
 	KVS_KEY = 'thermostat';
 if (!useExternalSensor) topicExternalSensor = null;

 // Define some functions

 function saveData() {
 	if (!dataHasChanged) return;
 	print("Saving target Data to KVS", KVS_KEY);
 	Shelly.call("KVS.Set", {
 		key: KVS_KEY,
 		value: {
 			'targetTemperature': targetTemperature,
 			'targetHeatingCoolingState': targetHeatingCoolingState,
 			'heatingThresholdTemperature': heatingThresholdTemperature,
 			'coolingThresholdTemperature': coolingThresholdTemperature,
 			'minHeatingTime': minHeatingTime,
 		}
 	});
 	dataHasChanged = false;
 };

 function getData() {
 	print("Reading from ", KVS_KEY);
 	Shelly.call(
 		"KVS.Get", {
 			key: KVS_KEY,
 		},
 		function(result, error_code, error_message) {
 			print("Read from KVS", JSON.stringify(error_code));
 			//targetTemperature exist
 			if (error_code === 0) {
 				print("Restored target settings :", JSON.stringify(result.value));
 				result = result.value;
 				targetTemperature = result.targetTemperature;
 				targetHeatingCoolingState = result.targetHeatingCoolingState;
 				heatingThresholdTemperature = result.heatingThresholdTemperature;
 				coolingThresholdTemperature = result.coolingThresholdTemperature;
 				minHeatingTime = result.minHeatingTime,
 					hysteresisCoolingTemperature = targetTemperature -
 					coolingThresholdTemperature;
 				hysteresisHeatingTemperature = heatingThresholdTemperature -
 					targetTemperature;
 				return;
 			}
 		}
 	);
 };

 function publishTarget() {
 	MQTT.publish(topicThermostat + '/targetTemperature',
 		JSON.stringify(targetTemperature), 0, false);
 	MQTT.publish(topicThermostat + '/targetHeatingCoolingState',
 		targetHeatingCoolingState, 0, false);
 	MQTT.publish(topicThermostat + '/heatingThresholdTemperature',
 		JSON.stringify(heatingThresholdTemperature), 0, false);
 	MQTT.publish(topicThermostat + '/coolingThresholdTemperature',
 		JSON.stringify(coolingThresholdTemperature), 0, false);
 };

 function publishCurrent() {
 	MQTT.publish(topicThermostat + '/currentHeatingCoolingState',
 		currentHeatingCoolingState, 0, false);
 	MQTT.publish(topicThermostat + '/currentTemperature',
 		JSON.stringify(currentTemperature), 0, false);
 };

 function heatControl() {
 	//	if (dataHasChanged) validateTargetData(); // to validate the target values
 	if (targetHeatingCoolingState === "HEAT") {
 		if ((currentTemperature < coolingThresholdTemperature) &&
 			(currentHeatingCoolingState !== "HEAT")) { // does nothing if already heating
 			print("CurrentTemperature", currentTemperature, " is lower than ",
 				coolingThresholdTemperature,
 				", starting heater");
 			currentHeatingCoolingState = "HEAT";
 			Shelly.call("Switch.Set", {
 				'id': 0,
 				'on': true
 			}); // start heater
 			//Start timer for minHeatTime
 			if (!holdTimer) { // to not start multiples Timers
 				holdTimer = true; // prevent to stop before a specified time
 				print("Starting timer for", minHeatingTime, "ms");
 				holdTimer_handle = Timer.set(minHeatingTime, true, function() {
 					print("Timer resumed");
 					holdTimer = false;
 				});
 			}
 		} else if ((currentTemperature > heatingThresholdTemperature) &&
 			(currentHeatingCoolingState === "HEAT")) {
 			print("CurrentTemperature", currentTemperature, " is higher than",
 				heatingThresholdTemperature,
 				", stoping heater");
 			if ((holdTimer) && (currentTemperature < maxAllowedTemperature)) {
 				print("minHeatTime not reached, waiting until timer resumes");
 			} else {
 				currentHeatingCoolingState = "OFF";
 				Timer.clear(holdTimer_handle);
 				Shelly.call("Switch.Set", {
 					'id': 0,
 					'on': false
 				}); // stop heater}
 			}
 		}
 	} else if ((targetHeatingCoolingState === "OFF") &&
 		(currentHeatingCoolingState === "HEAT")) {
 		print("TargetHeatingCoolingState is set to OFF, stopping heater");
 		currentHeatingCoolingState = "OFF";
 		Timer.clear(holdTimer_handle);
 		Shelly.call("Switch.Set", {
 			'id': 0,
 			'on': false
 		}); // stop heater
 	}
 	publishCurrent();
 };
 // reload function, clear all timers for debugging
 function cleanTimers() {
 	print("Clearing all timers...");
 	Timer.clear(controlTimer_handle);
 	Timer.clear(publishTargetTimer_handle);
 	Timer.clear(saveDataTimer_handle);
 	Timer.clear(holdTimer_handle);
 	Timer.clear(loadOnBootTimer_handle);
 }

 // create the thermostat function to load it in a timer
 function thermostat() {
 	//exit if no active MQTT connection or already running
 	if ((!MQTT.isConnected()) || (isRunning)) return;
 	// ok we are running now, try to clear the loadOnBootTimer to reduce memmory usage
 	isRunning = true;
 	Timer.clear(loadOnBootTimer_handle);
 	print('Thermostat Running, LoadOnBootTimer cleared');
 	// restore previous datas
 	if (restoreData) getData();
 	// publish the initial target and current values
 	publishTarget();
 	publishCurrent();
 	//Lauch timers for MQTT publish, Data save and heatcontrol
 	// Note i could merge heatControl and publishTarget if i need another timer
 	if (publishTargetTimer !== heatControlTimer) {
 		publishTargetTimer_handle = Timer.set(publishTargetTimer, true,
 			publishTarget);
 		heatControlTimer_handle = Timer.set(heatControlTimer, true, heatControl);
 	} else { // reducing timers usage
 		Timer.set(publishTargetTimer, true, function() {
 			publishTarget();
 			heatControl();
 		});
 	}
 	Timer.set(saveDataTimer, true, saveData);
 	// Subscribe to target datas:
 	//Note, to avoid continious majoration of values due to approximation of JSON.parse()
 	// i reject minor change less than 0.4, instead it will increase by 0.000001 every 5s
 	MQTT.subscribe(topicThermostat + '/targetTemperature',
 		function(topic, message) {
 			if (typeof message === "undefined") return;
 			message = JSON.parse(message);
 			if (typeof message !== "number") return;
 			if ((targetTemperature < message - 0.4) ||
 				(targetTemperature > message + 0.4)) {
 				print("Received new message from", topicThermostat +
 					'/targetTemperature:', JSON.stringify(message));
 				print("targetTemperature is now:", JSON.stringify(message),
 					" instead of ",
 					JSON.stringify(targetTemperature));
 				if ((message - minHysteresisCoolingTemperature < minAllowedTemperature) ||
 					(message - hysteresisCoolingTemperature < minAllowedTemperature)) {
 					targetTemperature = minAllowedTemperature +
 						minHysteresisCoolingTemperature;
 					coolingThresholdTemperature = minAllowedTemperature;
 					hysteresisCoolingTemperature = minHysteresisCoolingTemperature;
 					heatingThresholdTemperature = targetTemperature +
 						hysteresisHeatingTemperature;
 				} else if ((message + minHysteresisHeatingTemperature >
 						maxAllowedTemperature) ||
 					(message + hysteresisHeatingTemperature > maxAllowedTemperature)) {
 					targetTemperature = maxAllowedTemperature -
 						minHysteresisHeatingTemperature;
 					heatingThresholdTemperature = maxAllowedTemperature;
 					hysteresisHeatingTemperature = minHysteresisHeatingTemperature;
 					coolingThresholdTemperature = targetTemperature -
 						hysteresisCoolingTemperature;
 				} else {
 					targetTemperature = message;
 					coolingThresholdTemperature = targetTemperature -
 						hysteresisCoolingTemperature;
 					heatingThresholdTemperature = targetTemperature +
 						hysteresisHeatingTemperature;
 				}
 				dataHasChanged = true;
 			}
 		});
 	MQTT.subscribe(topicThermostat + '/targetHeatingCoolingState',
 		function(topic, message) {
 			if (typeof message === "undefined") return;
 			if (typeof message !== "string") return;
 			if (targetHeatingCoolingState === message) return;
 			print("Received new message from", topicThermostat +
 				'/targetHeatingCoolingState:', message
 			);
 			print("targetHeatingCoolingState is now:",
 				message,
 				" instead of ",
 				targetHeatingCoolingState);
 			targetHeatingCoolingState = message;
 			dataHasChanged = true;
 		});
 	MQTT.subscribe(topicThermostat + '/heatingThresholdTemperature',
 		function(topic, message) {
 			if (typeof message === "undefined") return;
 			message = JSON.parse(message);
 			if (typeof message !== "number") return;
 			if ((message < minAllowedTemperature) ||
 				(message > maxAllowedTemperature)) return;
 			if ((heatingThresholdTemperature < message - 0.4) ||
 				(heatingThresholdTemperature > message + 0.4)) {
 				print("Received new message from", topicThermostat +
 					'/heatingThresholdTemperature:', JSON.stringify(
 						message));
 				print("heatingThresholdTemperature is now:", JSON.stringify(
 						message),
 					" instead of ",
 					JSON.stringify(targetTemperature));
 				heatingThresholdTemperature = message;
 				targetTemperature = heatingThresholdTemperature -
 					hysteresisHeatingTemperature;
 				dataHasChanged = true;
 			}
 		});
 	MQTT.subscribe(topicThermostat + '/coolingThresholdTemperature',
 		function(topic, message) {
 			if (typeof message === "undefined") return;
 			message = JSON.parse(message);
 			if (typeof message !== "number") return;
 			if ((message < minAllowedTemperature) ||
 				(message > maxAllowedTemperature)) return;
 			if ((coolingThresholdTemperature < message - 0.4) ||
 				(coolingThresholdTemperature > message + 0.4)) {
 				print("Received new message from", topicThermostat +
 					'/coolingThresholdTemperature:', JSON.stringify(
 						message));
 				print("coolingThresholdTemperature is now:", JSON.stringify(
 						message),
 					" instead of ",
 					JSON.stringify(targetTemperature));
 				coolingThresholdTemperature = message;
 				targetTemperature = coolingThresholdTemperature +
 					hysteresisCoolingTemperature;
 				dataHasChanged = true;
 			}
 		});
 	//Subscribe to an external Sensor if needed
 	if (useExternalSensor) {
 		print("External Temperature Sensor enable")
 		MQTT.subscribe(topicExternalSensor, function(topic, message) {
 			message = JSON.parse(message);
 			if (typeof message.params === "undefined") return;
 			if (typeof message.params["temperature:0"] === "undefined")
 				return;
 			currentTemperature = message.params["temperature:0"].tC;
 			print(
 				"external temperature sensor has reported a currentTemperature :",
 				currentTemperature);
 		});
 	}
 	// Subscribe to internal sensors
 	Shelly.addStatusHandler(function(message) {
 		if (typeof message.component === "undefined") return;
 		if (!useExternalSensor) {
 			//report current temperature 
 			if (message.component === "temperature:0") {
 				if (typeof message.hysteresis.tC !== "undefined") {
 					currentTemperature = message.hysteresis.tC;
 				}
 			}
 		}
 		// report currentheatingCoolingState
 		if (message.component === "switch:0") {
 			if (typeof message.hysteresis.output !== "undefined") {
 				currentHeatingCoolingState = message.hysteresis.output ?
 					"HEAT" : "OFF";
 				print("currentHeatingCoolingState is now:"
 					currentHeatingCoolingState);
 			}
 		}
 	});
 };
 // Start thermostat() in a Timer, to wait until the device is fully ready
 loadOnBootTimer_handle = Timer.set(loadOnBootTimer, true, thermostat);
