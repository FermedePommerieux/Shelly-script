 // fix unexpected behavior of switch:2 if MQTT connection is lost
 let switchState = null,
 	wasDisconnected = null,
 	timer = 1000,
 	timer_handle = null,
 	timerHold = null;

 Shelly.addStatusHandler(function(e) {
 	if (e.component === "mqtt") {
 		if (e.delta.connected === false) wasDisconnected = true;
 		if ((e.delta.connected === true) && (wasDisconnected)) {
 			print("here comes the bug");
 			timerHold = true;
 			wasDisconnected = false;
 			switchState = Shelly.getComponentStatus('switch:2').output
 			timer_handle = Timer.set(timer, false, function() { timerHold = false; });
 		}
 	}
 	if (e.component === "switch:2") {
 		if ((timerHold) && (e.delta.source = "MQTT")) {
 			Shelly.call("Switch.set", { 'id': 2, 'on': switchState });
 			Timer.clear(timer_handle);
 		}
 	}
});
