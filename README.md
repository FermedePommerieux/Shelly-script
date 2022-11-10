# Shelly-script
Some Shelly scripts to automate things

As far i undestand (and how i use it):

## Componments

Componment are switch, inputs, ans sensors (humidity, temperature, ...), the are labelled like this 'switch:id' or 'input:0' ...

## Status

```javascript
Shelly.addStatusHandler(function (message) { 
  //act as momentary switch with input:0 by following the state of switch:0
  if (message.component === "switch:0") { // check if it concerns our switch
    if (typeof message.delta.output !== "undefined") { // check if it concerns state event
      Shelly.call("Switch.Set", {'id': 1,'on': message.delta.output}); // follow the state
    }
  }
  //act as flip as input:1
  if (message.component === "input:1") { // check if it concerns our input
    if (typeof message.delta.state !== "undefined") { // check if it concerns state event
      Shelly.call("Switch.Set", {'id': 0,'on':message.delta.state}); // follow the state id:1 will be set later
    }
  }
}
);
```


## Events

To trigger an event we use the following function:
```javascript
Shelly.addEventHandler( function (message) {your code})
```aa
The eventHandler will execute your code and provide a 'message' every time an event occurs. Note that, the shelly device will create one event message per event.

The 'message' is an object that could contain an event, and **could** contains an event related to a componment. **It must be filtered**.
```javascript
if (typeof message.info.event !== "undefined") {print('this message is an event')};
if (typeof message.info.componment !== "undefined") {print('this message concerns a componment')};
```
The componment event 'message' could then contains the needed attributes:

Input: see https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Input#status

Switch: see https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch#status

and so on...

## Comparing possibilities

Only strict comparing possibilities are available : ===, !==, >, <, nothing more
