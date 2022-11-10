# Shelly-script
Some Shelly scripts to automate things

As far i undestand (and how i use it):

## Componments

Componment are switch, inputs, ans sensors (humidity, temperature, ...), the are labelled like this 'switch:id' or 'input:0' ...

## Events

To trigger event it uses the funtion
```javascript
Shelly.addEventHandler( function (eventMessage) {your code})
```
The eventHandler will execute your code and provide the eventMessage every time an event occurs. Note that, the shelly device will create one event message per event.

The eventMessage is an object that could contain an event, and **could** contains an event related to a componment. **It must be filtered**.
```javascript
if (typeof eventMessage.info.event !== "undefined") {print('this eventMessage is an event')};
if (typeof eventMessage.info.componment !== "undefined") {print('this eventMessage concerns a componment')};
```
The componment event eventMessages could then contains the needed attributes:
Input: see https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Input#status
Switch: see https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch#status
and so on...


