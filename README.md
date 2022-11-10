# Shelly-script
Some Shelly scripts to automate things

As far i undestand (and how i use it):
##Events

The shelly device will create an event per event => this means we must filter the events messages and wait for the one we're waiting for:

event message are object and contain:

event.info.event

and other things:
Switch: see https://shelly-api-docs.shelly.cloud/gen2/ComponentsAndServices/Switch#status
