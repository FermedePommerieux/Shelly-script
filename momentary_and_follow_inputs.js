// This script makes ShellyPlus-2PM act as a unique switch with momentary and follow inputs
Shelly.call("Switch.SetConfig", {
  id: 0,
  config: {
    in_mode: "momentary",
  },
});

Shelly.call("Switch.SetConfig", {
  id: 1,
  config: {
    in_mode: "detached",
  },
});


Shelly.addEventHandler(function (event) {
  if (typeof event.info.event === "undefined") return;
  
  //act as momentary as input:0 by followin the state if switch:0
  if (event.info.component === "switch:0") { // check if it concerns our switch
    if (typeof event.info.state !== "undefined") { // check if it concerns state event
      Shelly.call("Switch.Set", {'id': 1,'on':event.info.state}); // follow the state
    }
  }
  //act as flip as input:1
  if (event.info.component === "input:1") { // check if it concerns our input
    if (typeof event.info.state !== "undefined") { // check if it concerns state event
      Shelly.call("Switch.Set", {'id': 0,'on':event.info.state}); // follow the state id:1 will be set later
    }
  }
}
);

