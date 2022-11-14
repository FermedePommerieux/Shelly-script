// 99% based on Shelly Script examples: Router Watchdog
//
// This script tries to execute HTTP GET requests within a set time, against a set of endpoints
// After certain number of failures the script reboot the device

let CONFIG = {
  endpoints: [
    "192.168.2.3",
    "192.168.2.1",
  ],
  //number of failures that trigger the reset
  numberOfFails: 3,
  //time in seconds after which the http request is considered failed
  httpTimeout: 10,
  //time in seconds for the relay to be off
  toggleTime: 30,
  //time in seconds to retry a "ping"
  pingTime: 60,
};

let endpointIdx = 0;
let failCounter = 0;
let pingTimer = null;

function pingEndpoints() {
  Shelly.call(
    "http.get",
    { url: CONFIG.endpoints[endpointIdx], timeout: CONFIG.httpTimeout },
    function (response, error_code, error_message) {
      //http timeout, magic number, not yet documented
      if (error_code === -114) {
        print("Failed to fetch ", CONFIG.endpoints[endpointIdx]);
        failCounter++;
        print("Rotating through endpoints");
        endpointIdx++;
        endpointIdx = endpointIdx % CONFIG.endpoints.length;
      } else {
        failCounter = 0;
      }

      if (failCounter >= CONFIG.numberOfFails) {
        print("Too many fails, resetting...");
        failCounter = 0;
        Timer.clear(pingTimer);
        //set the output with toggling back
        Shelly.call(
          "Shelly.Reboot"
        );
        die();
      }
    }
  );
}

print("Start watchdog timer");
pingTimer = Timer.set(CONFIG.pingTime * 1000, true, pingEndpoints);

Shelly.addEventHandler(function (event) {
  //timeout has expired and we have turned back power
  if (
    event.name === "switch" &&
    event.info.source === "timer" &&
    event.info.output === false
  ) {
    print("Start watchdog timer");
    pingTimer = Timer.set(CONFIG.pingTime * 1000, true, pingEndpoints);
  }
});
