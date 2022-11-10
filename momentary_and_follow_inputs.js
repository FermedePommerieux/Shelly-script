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

Shelly.addEventHandler(function (message) {
  if (typeof message.info.event === "undefined") return;
  
  //act as momentary as input:0 by followin the state if switch:0
  if (message.info.component === "switch:0") { // check if it concerns our switch
    if (typeof message.info.state !== "undefined") { // check if it concerns state event
      Shelly.call("Switch.Set", {'id': 1,'on': message.info.state}); // follow the state
    }
  }
  //act as flip as input:1
  if (meaage.info.component === "input:1") { // check if it concerns our input
    if (typeof message.info.state !== "undefined") { // check if it concerns state event
      Shelly.call("Switch.Set", {'id': 0,'on':message.info.state}); // follow the state id:1 will be set later
    }
  }
}
);

