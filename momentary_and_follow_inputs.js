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

Shelly.addStatusHandler(function (message) { 
  //act as momentary as input:0 by following the output if switch:0
  
  if (typeof message.component === "undefined") return;
  if (message.component === "switch:0") { // check if it concerns our switch
    if (typeof message.delta.output !== "undefined") { // check if it concerns output event
      Shelly.call("Switch.Set", {'id': 1,'on': message.delta.output}); // follow the output
    }
  }
  //act as flip by following the state of input:1
  if (message.component === "input:1") { // check if it concerns our input
    if (typeof message.delta.state !== "undefined") { // check if it concerns state event
      Shelly.call("Switch.Set", {'id': 0,'on':message.delta.state}); // follow the state id:1 will be set later
    }
  }
}
);

