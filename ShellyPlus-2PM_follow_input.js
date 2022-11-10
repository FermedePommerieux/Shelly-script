// this makes switch:0&1 to follow the input:1
// i use this to handle differents type of inputs to control a same switch (double) 

Shelly.addEventHandler(function (event) {
  if (typeof event.info.event === "undefined") return;
  if (event.info.component === "input:1") { // check if it concerns our input
    if (typeof event.info.state === "undefined") return; // check if it concerns state event
      Shelly.call("Switch.Set", {'id': 0,'on':event.info.state}); // follow the state
      Shelly.call("Switch.Set", {'id': 1,'on':event.info.state}); // follow the state
  }
}
);
