# Shelly-script
Some Shelly scripts to automate things

As far i undestand (and how i use it):

## Events

To trigger event it uses the funtion
```javascript
Shelly.addEventHandler( function (eventMessage) {your code})
```
The shelly device will create an event per event => this means we must filter the events messages and wait for the one we're waiting for.

The eventMessage is an object that could contain an event, and could contains an event related to a componment. it must be filtered
A componment could be switch or an input

event.info.event

and other things:
Switch: see https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch#status
