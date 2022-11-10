# Shelly-script
Some Shelly scripts to automate things

As far i undestand (and how i use it):

## Componments

Componment are switch, inputs, ans sensors (humidity, temperature, ...), the are labelled like this 'switch:id' or 'input:0' ...

## Events

To trigger an event we use the following funtion:
```javascript
Shelly.addEventHandler( function (message) {your code})
```
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
