 // This script makes ShellyPlus1 act as an MQTT heat-only thermostat
 // it will read and publish the following MQTT topics
 /*
     	"getCurrentHeatingCoolingState": "shellyplus1-XXXXXXXXXXXX/thermostat/currentHeatingCoolingState",
     	"setTargetHeatingCoolingState": "shellyplus1-XXXXXXXXXXXX/thermostat/targetHeatingCoolingState",
     	"getTargetHeatingCoolingState": "shellyplus1-XXXXXXXXXXXX/thermostat/targetHeatingCoolingState",
     	"getCurrentTemperature": "shellyplus1-XXXXXXXXXXXX/thermostat/currentTemperature",
     	"setTargetTemperature": "shellyplus1-XXXXXXXXXXXX/thermostat/targetTemperature",
     	"getTargetTemperature": "shellyplus1-XXXXXXXXXXXX/thermostat/targetTemperature",
     	
    Opt	"setCoolingThresholdTemperature": "shellyplus1-XXXXXXXXXXXX/thermostat/coolingThresholdTemperature"
    Opt	"getCoolingThresholdTemperature": "shellyplus1-XXXXXXXXXXXX/thermostat/coolingThresholdTemperature",
    Opt	"setHeatingThresholdTemperature": "shellyplus1-XXXXXXXXXXXX/thermostat/heatingThresholdTemperature"
    Opt	"getHeatingThresholdTemperature": "shellyplus1-XXXXXXXXXXXX/thermostat/ingThresholdTemperature"
    Opt	"getHeatingThresholdTemperature": "shellyplus1-XXXXXXXXXXXX/thermostat/hysteresisCoolingTemperature"
    Opt	"getHeatingThresholdTemperature": "shellyplus1-XXXXXXXXXXXX/thermostat/hysteresisHeatingTemperature"

    Opt	"getHeatingThresholdTemperature": "shellyplus1-XXXXXXXXXXXX/thermostat/willStart" in s
    Opt	"getHeatingThresholdTemperature": "shellyplus1-XXXXXXXXXXXX/thermostat/willStop" in s
    Opt	"getHeatingThresholdTemperature": "shellyplus1-XXXXXXXXXXXX/thermostat/dTdt" means instant deltaTemp/deltatime 
        */
 // Do not use extra topic in homebridge if you don't use it, otherwise it will mess your thermostat
 // Start/Stop time prediction could be enable for test only 
 // define config values, time are in ms and degree in celsius.
 let minHeatingTime = 15 * 60 * 1000,
 	targetTemperature = 20.5,
 	targetHeatingCoolingState = "HEAT",
 	heatingThresholdTemperature = 21.5,
 	coolingThresholdTemperature = 19,
 	minAllowedTemperature = 16,
 	maxAllowedTemperature = 24,
 	minHysteresisHeatingCoolingTemperature = 0.5,
 	useExternalSensor = false,
 	topicExternalSensor = 'shellyplusht-c049ef8e1ddc/events/rpc',
 	topicInternalSensor = "temperature:100",
 	restoreData = true, // set to false to use local declared target at startup
 	enableExtra = true // Enable Eve topics heating/coolingThreshold
 	enablePredict = true, // try to predict time remaining until start/stop
 	enablePredictHeatControl = false, // Start/Stop heater on predict time instead of waiting to rise threshold temperatures
 	useCompositeSensor = true; // to use internal and external sensors (high/low temperatures)

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
 	deltaValue = 0.09,
 	isRunning = false,
 	dataHasChanged = true,
 	holdTimer = false,
 	heatControlTimer_handle = null,
 	publishTargetTimer_handle = null,
 	saveDataTimer_handle = null, // will be merged to publishTargetTimer
 	holdTimer_handle = null,
 	loadOnBootTimer_handle = null,
 	currentTemperature = targetTemperature,
 	currentHeatingCoolingState = Shelly.getComponentStatus('switch:0').output ?
 	"HEAT" : "OFF",
 	topicThermostat = Shelly.getDeviceInfo().id + '/thermostat',
 	KVS_KEY = 'thermostat',
 	currentTime = null,
 	oldTime = null,
 	oldTemperature = null,
 	dTdt = null,
 	willStopTime = null,
 	willStartTime = null,
 	sensorLatency = null,
 	predictTimer_handle = null,
 	oldExternalTemperature = null,
 	currentExternalTemperature = null,
 	oldInternalTemperature = null,
 	currentInternalTemperature = null,
 	internalTS = null,
 	externalTS = null;
 if ((useExternalSensor) || (useCompositeSensor)) {
 	currentInternalTemperature = Shelly.getComponentStatus(topicInternalSensor).tC;
 	currentTemperature = currentInternalTemperature;
 }

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
 	if (dataHasChanged) return;
 	MQTT.publish(topicThermostat + '/targetTemperature',
 		JSON.stringify(targetTemperature), 0, false);
 	MQTT.publish(topicThermostat + '/targetHeatingCoolingState',
 		targetHeatingCoolingState, 0, false);
 	MQTT.publish(topicThermostat + '/heatingThresholdTemperature',
 		JSON.stringify(heatingThresholdTemperature), 0, false);
 	MQTT.publish(topicThermostat + '/coolingThresholdTemperature',
 		JSON.stringify(coolingThresholdTemperature), 0, false);
 	MQTT.publish(topicThermostat + '/hysteresisCoolingTemperature',
 		JSON.stringify(hysteresisCoolingTemperature), 0, false);
 	MQTT.publish(topicThermostat + '/hysteresisHeatingTemperature',
 		JSON.stringify(hysteresisHeatingTemperature), 0, false);
 };

 function publishCurrent() {
 	MQTT.publish(topicThermostat + '/currentHeatingCoolingState',
 		currentHeatingCoolingState, 0, false);
 	MQTT.publish(topicThermostat + '/currentTemperature',
 		JSON.stringify(currentTemperature), 0, false);
 	if (enablePredict) {
 		MQTT.publish(topicThermostat + '/dTdt',
 			JSON.stringify(dTdt), 0, false);
 		if (targetHeatingCoolingState === "HEAT") {
 			if (currentHeatingCoolingState === "HEAT") {
 				MQTT.publish(topicThermostat + '/willStop',
 					JSON.stringify(willStopTime), 0, false);
 			} else {
 				MQTT.publish(topicThermostat + '/willStart',
 					JSON.stringify(willStartTime), 0, false);
 			}
 		} else {
 			MQTT.publish(topicThermostat + '/willStop',
 				JSON.stringify(null), 0, false);
 			MQTT.publish(topicThermostat + '/willStart',
 				JSON.stringify(null), 0, false);
 		}
 	}
 };

 function getTemperature() {
 	if (useExternalSensor) {
 		print("Using currentTemperature from external sensor");
 		currentTemperature = currentExternalTemperature;
 		oldTemperature = oldExternalTemperature;
 	} else if (!useCompositeSensor) {
 		print("Using currentTemperature from internal sensor")
 		currentTemperature = currentInternalTemperature;
 		oldTemperature = oldInternalTemperature;
 	} else if (useCompositeSensor) {
 		print("Using currentTemperature from internal/external sensor :",
 			currentInternalTemperature, "/",
 			currentExternalTemperature);
 		// here we use median values and max/min in somes cases:
 		// check if we have external data or data are not too old (20 minutes)
 		if ((typeof externalTS === "number") && (currentTime - externalTS < 20 * 60 *
 				1000)) { // not too old
 			oldTemperature = currentTemperature;
 			currentTemperature = (currentInternalTemperature +
 				currentExternalTemperature) / 2;
 			if ((currentInternalTemperature < coolingThresholdTemperature) &&
 				(currentExternalTemperature < targetTemperature)) currentTemperature =
 				currentInternalTemperature;
 			if ((currentInternalTemperature > heatingThresholdTemperature) &&
 				(currentExternalTemperature > targetTemperature)) currentTemperature =
 				currentInternalTemperature;
 			if ((currentExternalTemperature < coolingThresholdTemperature) &&
 				(currentInternalTemperature < targetTemperature)) currentTemperature =
 				currentExternalTemperature;
 			if ((currentExternalTemperature > heatingThresholdTemperature) &&
 				(currentInternalTemperature > targetTemperature)) currentTemperature =
 				currentExternalTemperature;
 		} else { // externalTemperature is old/unavailable, can't use it
 			print("External temperature not available, using internal only");
 			currentTemperature = currentInternalTemperature;
 		}
 	}
 	if (enablePredict) predict();
 }

 function heatControl(predict) {
 	if (targetHeatingCoolingState === "HEAT") {
 		if (((currentTemperature < coolingThresholdTemperature) &&
 				(currentHeatingCoolingState !== "HEAT")) ||
 			(predict === "HEAT")) { // does nothing if already heating
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
 		} else if (((currentTemperature > heatingThresholdTemperature) &&
 				(currentHeatingCoolingState === "HEAT")) ||
 			(predict === "OFF")) {
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
 	Timer.clear(heatControlTimer_handle);
 	Timer.clear(predictTimer_handle);
 	// 	Timer.clear(saveDataTimer_handle);
 	Timer.clear(holdTimer_handle);
 	Timer.clear(loadOnBootTimer_handle);
 }
 // predict function for high latency sensors to start heating before get cold
 function predict() {
 	// calculate heating/cooling coeficient
 	Shelly.call('Sys.GetStatus', {}, function(status) {
 		currentTime = status.unixtime;
 	});
 	if (typeof currentTime !== "number") return;
 	if ((typeof oldTime === "number") && (oldTime !== currentTime)) {
 		sensorLatency = currentTime - oldTime;
 		dTdt =
 			(currentTemperature - oldTemperature) / (sensorLatency);
 		print("dTdt is:", dTdt);
 		// predict when currentTemperature will reach coolingThreshold
 		if (typeof dTdt === "number") {
 			if ((dTdt > 0) || (dTdt < 0)) {
 				willStartTime = (coolingThresholdTemperature - currentTemperature) /
 					dTdt; // dTdt <0
 				willStopTime = (heatingThresholdTemperature - currentTemperature) /
 					dTdt; // dTdt >0
 				if (currentHeatingCoolingState === "OFF") {
 					print("currentTemperature will reach ",
 						coolingThresholdTemperature, " in", willStartTime, "s");
 				} else {
 					print("currentTemperature will reach ",
 						heatingThresholdTemperature, " in", willStopTime, "s");
 				}
 			}
 		}
 	}
 	oldTime = currentTime;
 	// ok now, predict when to start/stop heating
 	if (enablePredictHeatControl) {
 		if ((sensorLatency !== null) && (willStartTime !== null) && (willStopTime !==
 				null)) {
 			//  clear Timers, in case a temperature sensor reports a new value
 			Timer.clear(predictTimer_handle);
 			if ((currentHeatingCoolingState === "OFF") && (willStartTime <
 					sensorLatency) &&
 				(willStartTime > 0)) {
 				predictTimer_handle = Timer.set(willStartTime, false, function() {
 					heatControl("HEAT");
 				});
 			} else if ((currentHeatingCoolingState === "HEAT") && (willStopTime <
 					sensorLatency) &&
 				(willStopTime > 0)) {
 				predictTimer_handle = Timer.set(willStopTime, false, function() {
 					heatControl("OFF");
 				});
 			}
 		}
 	}
 };

 // create the thermostat function to load it in a timer
 function thermostat() {
 	//exit if no active MQTT connection or already running
 	if ((!MQTT.isConnected()) || (isRunning)) return;
 	// ok we are running now, try to clear the loadOnBootTimer to reduce memmory usage
 	isRunning = true;
 	Timer.clear(loadOnBootTimer_handle);
 	// restore previous datas
 	if (restoreData) getData();
 	// publish the initial target and current values
 	publishTarget();
 	publishCurrent();
 	//Lauch timers for MQTT publish, Data save and heatcontrol

 	heatControlTimer_handle = Timer.set(publishTargetTimer, true, function() {
 		publishTarget();
 		heatControl();
 		saveData();
 	});
 	// Subscribe to target datas:
 	//Note, to avoid continious majoration of values due to approximation of JSON.parse()
 	// i reject minor change less than minHysteresisHeatingCoolingTemperature
 	MQTT.subscribe(topicThermostat + '/targetTemperature',
 		function(topic, message) {
 			if (typeof message === "undefined") return;
 			message = JSON.parse(message);
 			if (typeof message !== "number") return;
 			if (message === targetTemperature) return;
 			if ((targetTemperature < message -
 					deltaValue) ||
 				(targetTemperature > message +
 					deltaValue)
 			) {
 				print("Received new message from", topicThermostat +
 					'/targetTemperature:', JSON.stringify(message));
 				print("targetTemperature is now:", JSON.stringify(message),
 					" instead of ",
 					JSON.stringify(targetTemperature));
 				if ((message - minHysteresisHeatingCoolingTemperature <
 						minAllowedTemperature) ||
 					(message - hysteresisCoolingTemperature < minAllowedTemperature)) {
 					targetTemperature = minAllowedTemperature +
 						minHysteresisHeatingCoolingTemperature;
 					coolingThresholdTemperature = minAllowedTemperature;
 					hysteresisCoolingTemperature = minHysteresisHeatingCoolingTemperature;
 					heatingThresholdTemperature = targetTemperature +
 						hysteresisHeatingTemperature;
 				} else if ((message + minHysteresisHeatingCoolingTemperature >
 						maxAllowedTemperature) ||
 					(message + hysteresisHeatingTemperature > maxAllowedTemperature)) {
 					targetTemperature = maxAllowedTemperature -
 						minHysteresisHeatingCoolingTemperature;
 					heatingThresholdTemperature = maxAllowedTemperature;
 					hysteresisHeatingTemperature = minHysteresisHeatingCoolingTemperature;
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
 	if (enableExtra) {
 		MQTT.subscribe(topicThermostat + '/heatingThresholdTemperature',
 			function(topic, message) {
 				if (typeof message === "undefined") return;
 				message = JSON.parse(message);
 				if (typeof message !== "number") return;
 				if (message === heatingThresholdTemperature) return;
 				if ((message < minAllowedTemperature) ||
 					(message > maxAllowedTemperature) ||
 					(message < targetTemperature - minHysteresisHeatingCoolingTemperature)
 				) return;
 				// avoid minor changes
 				if ((heatingThresholdTemperature < message -
 						deltaValue) ||
 					(heatingThresholdTemperature > message +
 						deltaValue)
 				) {
 					print("Received new message from", topicThermostat +
 						'/heatingThresholdTemperature:', JSON.stringify(
 							message));
 					print("heatingThresholdTemperature is now:", JSON.stringify(
 							message),
 						" instead of ",
 						JSON.stringify(heatingThresholdTemperature));
 					heatingThresholdTemperature = message;
 					hysteresisHeatingTemperature = heatingThresholdTemperature -
 						targetTemperature;
 					dataHasChanged = true;
 				}
 			});
 		MQTT.subscribe(topicThermostat + '/coolingThresholdTemperature',
 			function(topic, message) {
 				if (typeof message === "undefined") return;
 				message = JSON.parse(message);
 				if (typeof message !== "number") return;
 				if (message === coolingThresholdTemperature) return;
 				if ((message < minAllowedTemperature) ||
 					(message > maxAllowedTemperature) ||
 					(message > targetTemperature - minHysteresisHeatingCoolingTemperature)
 				) return;
 				if ((coolingThresholdTemperature < message -
 						deltaValue) ||
 					(coolingThresholdTemperature > message +
 						deltaValue)
 				) {
 					print("Received new message from", topicThermostat +
 						'/coolingThresholdTemperature:', JSON.stringify(
 							message));
 					print("coolingThresholdTemperature is now:", JSON.stringify(
 							message),
 						" instead of ",
 						JSON.stringify(coolingThresholdTemperature));
 					coolingThresholdTemperature = message;
 					hysteresisCoolingTemperature = targetTemperature -
 						coolingThresholdTemperature;
 					dataHasChanged = true;
 				}
 			}
 		);
 		MQTT.subscribe(topicThermostat + '/hysteresisCoolingTemperature',
 			function(topic, message) {
 				if (typeof message === "undefined") return;
 				message = JSON.parse(message);
 				if (typeof message !== "number") return;
 				if (message === hysteresisCoolingTemperature) return;
 				if ((message < minHysteresisHeatingCoolingTemperature) ||
 					(message > targetTemperature - minAllowedTemperature)) return;
 				if ((hysteresisCoolingTemperature < message -
 						deltaValue) ||
 					(hysteresisCoolingTemperature > message +
 						deltaValue)
 				) {
 					print("Received new message from", topicThermostat +
 						'/hysteresisCoolingTemperature:', JSON.stringify(
 							message));
 					print("hysteresisCoolingTemperature is now:", JSON.stringify(
 							message),
 						" instead of ",
 						JSON.stringify(hysteresisCoolingTemperature));
 					hysteresisCoolingTemperature = message;
 					coolingThresholdTemperature = targetTemperature -
 						hysteresisCoolingTemperature;
 					dataHasChanged = true;
 				}
 			}
 		);
 		MQTT.subscribe(topicThermostat + '/hysteresisHeatingTemperature',
 			function(topic, message) {
 				if (typeof message === "undefined") return;
 				message = JSON.parse(message);
 				if (typeof message !== "number") return;
 				if (message === hysteresisHeatingTemperature) return;
 				if ((message < minHysteresisHeatingCoolingTemperature) ||
 					(message > maxAllowedTemperature - targetTemperature)) return;
 				if ((hysteresisHeatingTemperature < message -
 						deltaValue) ||
 					(hysteresisHeatingTemperature > message +
 						deltaValue)
 				) {
 					print("Received new message from", topicThermostat +
 						'/hysteresisHeatingTemperature:', JSON.stringify(
 							message));
 					print("hysteresisHeatingTemperature is now:", JSON.stringify(
 							message),
 						" instead of ",
 						JSON.stringify(hysteresisHeatingTemperature));
 					hysteresisHeatingTemperature = message;
 					coolingThresholdTemperature = targetTemperature -
 						hysteresisHeatingTemperature;
 					dataHasChanged = true;
 				}
 			});



 	}
 	//Subscribe to an external Sensor if needed
 	if ((useCompositeSensor) || (useExternalSensor)) {
 		print("External Temperature Sensor enable")
 		MQTT.subscribe(topicExternalSensor, function(topic, message) {
 			message = JSON.parse(message);
 			if (typeof message.params === "undefined") return;
 			if (typeof message.params["temperature:0"] === "undefined")
 				return;
 			oldExternalTemperature = currentExternalTemperature;
 			currentExternalTemperature = message.params["temperature:0"].tC;
 			Shelly.call('Sys.GetStatus', {}, function(status) {
 				externalTS = status.unixtime;
 			});
 			print(
 				"external temperature sensor has reported a currentTemperature :",
 				currentExternalTemperature);
 			getTemperature();
 		});
 	}
 	// Subscribe to internal sensors
 	Shelly.addStatusHandler(function(message) {
 		if (typeof message.component === "undefined") return;
 		if (!useExternalSensor) {
 			//report current temperature 
 			if (message.component === topicInternalSensor) {
 				if (typeof message.delta.tC !== "undefined") {
 					oldInternalTemperature = currentInternalTemperature;
 					currentInternalTemperature = message.delta.tC;
 					Shelly.call('Sys.GetStatus', {}, function(status) {
 						internalTS = status.unixtime;
 					});
 					print(
 						"internal temperature sensor has reported a currentTemperature :",
 						currentInternalTemperature);
 					getTemperature();
 				}
 			}
 		}
 		// report currentheatingCoolingState
 		if (message.component === "switch:0") {
 			if (typeof message.delta.output !== "undefined") {
 				currentHeatingCoolingState = message.delta.output ?
 					"HEAT" : "OFF";
 				print("currentHeatingCoolingState is now:"
 					currentHeatingCoolingState);
 			}
 		}
 	});
 };
 // Start thermostat() in a Timer, to wait until the device is fully ready
 loadOnBootTimer_handle = Timer.set(loadOnBootTimer, true, thermostat);
