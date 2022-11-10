// this makes switch:1 to follow the state of switch:0

//check swithc:1 is in detached mode
Shelly.call("Switch.SetConfig", {
  id: 1,
  config: {
    in_mode: "detached",
  },
});

Shelly.addEventHandler(function (event) {
  if (typeof event.info.event === "undefined") return;
  if (event.info.component === "switch:0") { // check if it concerns our switch
    if (typeof event.info.state === "undefined") return; // check if it concerns state event
      Shelly.call("Switch.Set", {'id': 1,'on':event.info.state}); // follow the state
  }
}
);
