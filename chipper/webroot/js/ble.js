const vectorEpodSetup = "https://wpsetup.keriganc.com";

var authEl = document.getElementById("botAuth");
var statusP = document.createElement("p");
var externalSetup = document.createElement("a");
var OTAUpdating = false;
externalSetup.href = vectorEpodSetup;
externalSetup.innerHTML = vectorEpodSetup;

function showBotAuth() {
  GetLog = false;
  document.getElementById("section-intents").style.display = "none";
  document.getElementById("section-language").style.display = "none";
  document.getElementById("section-log").style.display = "none";
  document.getElementById("section-botauth").style.display = "block";
  updateColor("icon-BotAuth");
  checkBLECapability();
}

function checkBLECapability() {
  document.getElementById("disconnectButton").innerHTML = "";
  updateAuthel("Checking if wire-pod can use BLE directly...");
  fetch("/api-ble/init")
    .then((response) => response.text())
    .then((response) => {
      if (response.includes("success")) {
        BeginBLESetup();
      } else {
        authEl.innerHTML = "";
        m1 = document.createElement("p");
        m2 = document.createElement("a");
        m3 = document.createElement("small");
        m1.innerHTML =
          "Head to the following site on any device with Bluetooth support to set up your Vector.";
        m2.text = vectorEpodSetup;
        m2.href = vectorEpodSetup;
        m2.target = "_blank";
        m3.innerHTML =
          "Note: with OSKR/dev robots, it might give a warning about firmware. This can be ignored.";
        m1.class = "center";
        m2.class = "center";
        m3.class = "center";
        authEl.appendChild(m1);
        //authEl.appendChild(document.createElement("br"))
        authEl.appendChild(m2);
        authEl.appendChild(document.createElement("br"));
        authEl.appendChild(m3);
      }
    });
}

function BeginBLESetup() {
  authEl.innerHTML = "";
  m1 = document.createElement("p");
  m1.innerHTML = "1. Place Vector on the charger.";
  m2 = document.createElement("p");
  m2.innerHTML = "2. Double press the button. A key should appear on screen.";
  m3 = document.createElement("p");
  m3.innerHTML = "3. Click 'Begin Scanning' and pair with your Vector.";
  button = document.createElement("button");
  button.innerHTML = "Begin Scanning";
  button.onclick = function () {
    ScanRobots(false);
  };
  authEl.appendChild(m1);
  authEl.appendChild(m2);
  authEl.appendChild(m3);
  authEl.appendChild(button);
}

function ReInitBLE() {
  fetch("/api-ble/disconnect").then(() => fetch("/api-ble/init"));
}

function ScanRobots(returning) {
  disconnectButtonDiv = document.getElementById("disconnectButton");
  disconnectButtonDiv.innerHTML = "";
  disconnectButton = document.createElement("button");
  disconnectButton.onclick = function () {
    Disconnect();
  };
  disconnectButton.innerHTML = "Disconnect";
  disconnectButtonDiv.appendChild(disconnectButton);
  authEl.innerHTML = "";
  statusDiv = document.createElement("div");
  buttonsDiv = document.createElement("div");
  buttonsDiv.class = "center";
  statusDiv.class = "center";
  if (returning) {
    incorrectPin = document.createElement("p");
    incorrectPin.innerHTML = "Incorrect PIN was entered, scanning again...";
    statusDiv.appendChild(incorrectPin);
  }
  scanNotice = document.createElement("small");
  scanNotice.innerHTML = "Scanning...";
  statusDiv.appendChild(scanNotice);
  authEl.appendChild(statusDiv);
  var xhr = new XMLHttpRequest();
  xhr.open("POST", "/api-ble/scan");
  xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
  xhr.send();
  xhr.onload = function () {
    response = xhr.response;
    console.log(response);
    parsed = JSON.parse(response);
    buttonsDiv.innerHTML = "";
    authEl.innerHTML = "";
    for (var i = 0; i < parsed.length; i++) {
      button = document.createElement("button");
      id = parsed[i]["id"];
      button.innerHTML = parsed[i]["name"];
      button.onclick = function () {
        ConnectRobot(id);
      };
      buttonsDiv.appendChild(button);
    }
    rescanB = document.createElement("button");
    rescanB.innerHTML = "Re-scan";
    rescanB.onclick = function () {
      updateAuthel("Reiniting BLE then scanning...");
      fetch("/api-ble/disconnect").then(() =>
        fetch("/api-ble/init").then(() => ScanRobots(false))
      );
    };
    updateAuthel("Click on the robot you would like to pair with.");
    authEl.appendChild(rescanB);
    authEl.appendChild(buttonsDiv);
  };
}

function Disconnect() {
  disconnectButtonDiv = document.getElementById("disconnectButton");
  disconnectButtonDiv.innerHTML = "";
  authEl.innerHTML = "";
  statusP.innerHTML = "Disconnecting...";
  authEl.appendChild(statusP);
  if (OTAUpdating) {
    OTAUpdating = false;
    fetch("/api-ble/stop_ota").then(() =>
      setTimeout(function () {
        fetch("/api-ble/disconnect").then(() => {
          setTimeout(function () {
            checkBLECapability();
          }, 2000);
        });
      }, 1000)
    );
  } else {
    fetch("/api-ble/disconnect").then(() => {
      setTimeout(function () {
        checkBLECapability();
      }, 2000);
    });
  }
}

function ConnectRobot(id) {
  updateAuthel("Connecting to robot...");
  fetch("/api-ble/connect?id=" + id)
    .then((response) => response.text())
    .then((response) => {
      if (response.includes("success")) {
        CreatePinEntry();
        return;
      } else {
        alert(
          "There was an error connecting. WirePod will restart and this will return to the first screen of setup."
        );
        updateAuthel("Waiting for WirePod to restart...");
        setTimeout(function () {
          checkBLECapability();
        }, 3000);
      }
    });
}

function validateInput(input) {
  return input.value.length <= 6 && /^\d+$/.test(input.value);
}

function CreatePinEntry() {
  authEl.innerHTML = "";
  statusDiv = document.createElement("div");
  statusP.innerHTML = "Enter the pin shown on Vector's screen.";
  statusDiv.appendChild(statusP);
  authEl.appendChild(statusDiv);
  pinEntry = document.createElement("input");
  pinEntry.type = "text";
  pinEntry.id = "pinEntry";
  pinEntry.name = "pinEntry";
  pinEntry.placeholder = "Enter PIN here";
  pinEntry.setAttribute("type", "text");
  pinEntry.setAttribute("maxlength", "6");
  pinEntry.setAttribute("oninput", function () {
    validateInput(this);
  });
  button = document.createElement("button");
  button.onclick = function () {
    SendPin();
  };
  button.innerHTML = "Send PIN";
  authEl.appendChild(pinEntry);
  authEl.appendChild(document.createElement("br"));
  authEl.appendChild(button);
  return;
}

function SendPin() {
  pin = document.getElementById("pinEntry").value;
  updateAuthel("Sending PIN...");
  fetch("/api-ble/send_pin?pin=" + pin)
    .then((response) => response.text())
    .then((response) => {
      console.log(response);
      if (
        response.includes("incorrect pin") ||
        response.includes("length of pin")
      ) {
        updateAuthel("Wrong PIN... Reiniting BLE then scanning...");
        fetch("/api-ble/disconnect").then(() =>
          fetch("/api-ble/init").then(() => ScanRobots(true))
        );
      } else {
        WifiCheck();
      }
      return;
    });
}

function WifiCheck() {
  fetch("/api-ble/get_wifi_status")
    .then((response) => response.text())
    .then((response) => {
      console.log(response);
      if (response == "1") {
        WhatToDo();
      } else {
        ScanWifi();
      }
      return;
    });
}

function ScanWifi() {
  authEl.innerHTML = "";
  statusP.innerHTML = "Scanning for Wi-Fi networks...";
  authEl.appendChild(statusP);
  var xhr = new XMLHttpRequest();
  xhr.open("GET", "/api-ble/scan_wifi", true);
  xhr.onreadystatechange = function () {
    if (this.readyState === XMLHttpRequest.DONE && this.status === 200) {
      authEl.innerHTML = "";
      updateAuthel("Select a Wi-Fi network to connect Vector to.");
      // create scan again button
      var scanAgain = document.createElement("button");
      scanAgain.innerHTML = "Scan Again";
      scanAgain.onclick = function () {
        ScanWifi();
      };
      authEl.appendChild(scanAgain);
      authEl.appendChild(document.createElement("br"));
      // add network buttons
      var networks = JSON.parse(this.responseText);
      for (var i = 0; i < networks.length; i++) {
        var ssid = networks[i].ssid;
        if (ssid != "") {
          var authtype = networks[i].authtype;
          var btn = document.createElement("button");
          btn.innerHTML = ssid;
          btn.onclick = (function (ssid, authtype) {
            return function () {
              CreateWiFiPassEntry(ssid, authtype);
            };
          })(ssid, authtype);
          authEl.appendChild(btn);
        }
      }
    }
  };
  xhr.send();
}

function CreateWiFiPassEntry(ssid, authtype) {
  console.log(ssid);
  console.log(authtype);
  authEl.innerHTML = "";
  againButton = document.createElement("button");
  againButton.innerHTML = "Scan Again";
  againButton.onclick = function () {
    ScanWifi();
  };
  authEl.appendChild;
  statusDiv = document.createElement("div");
  statusP.innerHTML = "Enter the password for " + ssid;
  statusDiv.appendChild(statusP);
  authEl.appendChild(statusDiv);
  pinEntry = document.createElement("input");
  pinEntry.type = "text";
  pinEntry.id = "passEntry";
  pinEntry.name = "passEntry";
  pinEntry.placeholder = "Password";
  button = document.createElement("button");
  button.onclick = function () {
    ConnectWifi(ssid, authtype);
  };
  button.innerHTML = "Connect to Wi-Fi";
  authEl.appendChild(pinEntry);
  authEl.appendChild(document.createElement("br"));
  authEl.appendChild(button);
  return;
}

function ConnectWifi(ssid, authtype) {
  password = document.getElementById("passEntry").value;
  authEl.innerHTML = "";
  passP = document.createElement("p");
  passP.innerHTML = "Connecting Vector to Wi-Fi...";
  authEl.appendChild(passP);
  fetch(
    "/api-ble/connect_wifi?ssid=" +
      ssid +
      "&password=" +
      password +
      "&authType=" +
      authtype
  )
    .then((response) => response.text())
    .then((response) => {
      if (!response.includes("255")) {
        alert("Error connecting, likely incorrect password");
        CreateWiFiPassEntry(ssid, authtype);
      } else {
        WhatToDo();
      }
    });
}

function CheckFirmware() {
  fetch("/api-ble/get_firmware")
    .then((response) => response.text())
    .then((response) => {
      let splitFirmware = response.split("-");
      console.log(splitFirmware);
    });
}

function WhatToDo() {
  fetch("/api-ble/get_robot_status")
    .then((response) => response.text())
    .then((response) => {
      if (response == "in_recovery_prod") {
        DoOTA("local");
      } else if (response == "in_recovery_dev") {
        DoOTA("http://wpsetup.keriganc.com:81/1.6.0.3331.ota");
      } else if (response == "in_firmware_nonep") {
        authEl.innerHTML = "";
        m1 = document.createElement("p");
        m1.innerHTML = "1. Place Vector on the charger.";
        m2 = document.createElement("p");
        m2.innerHTML =
          "2. Hold the button for 15 seconds. He will turn off - keep holding it until he turns back on.";
        m3 = document.createElement("p");
        m3.innerHTML = "3. Click 'Begin Scanning' and pair with your Vector.";
        button = document.createElement("button");
        button.innerHTML = "Begin Scanning";
        button.onclick = function () {
          ScanRobots(false);
        };
        authEl.appendChild(m1);
        authEl.appendChild(m2);
        authEl.appendChild(m3);
        authEl.appendChild(button);
        alert(
          "Your bot is not on the correct firmware for wire-pod. Follow the directions to put him in recovery mode."
        );
      } else if (response == "in_firmware_dev") {
        alert(
          "Your bot is a dev robot. Make sure you have done the 'Configure an OSKR/dev-unlocked robot' section before authentication. If you did already, you can ignore this warning."
        );
        authEl.innerHTML = "";
        button = document.createElement("button");
        button.innerHTML = "AUTHENTICATE";
        button.onclick = function () {
          DoAuth();
        };
        authEl.appendChild(button);
      } else if (response == "in_firmware_ep") {
        authEl.innerHTML = "";
        button = document.createElement("button");
        button.innerHTML = "AUTHENTICATE";
        button.onclick = function () {
          DoAuth();
        };
        authEl.appendChild(button);
      }
    });
}

function DoOTA(url) {
  updateAuthel("Starting OTA update...");
  fetch("/api-ble/start_ota?url=" + url)
    .then((response) => response.text())
    .then((response) => {
      if (response.includes("success")) {
        OTAUpdating = true;
        inte = setInterval(function () {
          fetch("/api-ble/get_ota_status")
            .then((otaresp) => otaresp.text())
            .then((otaresp) => {
              if (otaresp.includes("complete")) {
                updateAuthel(otaresp);
                checkBLECapability();
                alert(
                  "The OTA update is complete. When the bot reboots, follow the steps to re-pair the bot with wire-pod. wire-pod will then authenticate the robot and setup will be complete."
                );
                OTAUpdating = false;
                clearInterval(inte);
              } else if (otaresp.includes("stopped")) {
                OTAUpdating = false;
                clearInterval(inte);
              } else if (!OTAUpdating) {
                clearInterval(inte);
              } else {
                updateAuthel(otaresp);
              }
            });
        }, 2000);
      } else {
        WhatToDo();
      }
    });
}

function updateAuthel(update) {
  authEl.innerHTML = "";
  authP = document.createElement("p");
  authP.innerHTML = update;
  authEl.appendChild(authP);
}

function DoAuth() {
  updateAuthel("Authenticating your Vector...");
  fetch("/api-ble/do_auth")
    .then((response) => response.text())
    .then((response) => {
      console.log(response);
      if (response.includes("error")) {
        updateAuthel(
          "Authentication failure. Try again in ~15 seconds. If it happens again, check the troubleshooting guide:"
        );
        m2 = document.createElement("a");
        m2.text = "https://github.com/rugatling/wire-pod/wiki/Troubleshooting";
        m2.href =
          "https://github.com/rugatling/wire-pod/wiki/Troubleshooting#error-logging-in-the-bot-is-likely-unable-to-communicate-with-your-wire-pod-instance";
        m2.target = "_blank";
        authEl.appendChild(document.createElement("br"));
        authEl.appendChild(m2);
      } else {
        updateAuthel(
          "Authentication was successful! How would you like to wake Vector up?"
        );
        wakeWithAnim = document.createElement("button");
        wakeWithAnim.onclick = function () {
          DoOnboard(true);
        };
        wakeWithAnim.innerHTML = "Wake with wake-up animation (recommended)";
        wakeWithoutAnim = document.createElement("button");
        wakeWithoutAnim.innerHTML =
          "Wake immediately, without wake-up animation";
        wakeWithoutAnim.onclick = function () {
          DoOnboard(false);
        };
        authEl.appendChild(wakeWithAnim);
        authEl.appendChild(document.createElement("br"));
        authEl.appendChild(wakeWithoutAnim);
      }
    });
}

function DoOnboard(wAnim) {
  updateAuthel("Onboarding robot...");
  fetch("/api-ble/onboard?with_anim=" + wAnim).then(() => {
    fetch("/api-ble/disconnect");
    updateAuthel(
      "Vector is now fully set up! Use the Bot Settings tab to further configure your bot."
    );
    disconnectButtonDiv = document.getElementById("disconnectButton");
    disconnectButtonDiv.innerHTML = "";
    disconnectButton = document.createElement("button");
    disconnectButton.onclick = function () {
      checkBLECapability();
    };
    disconnectButton.innerHTML = "Return to pair instructions";
    disconnectButtonDiv.appendChild(disconnectButton);
  });
}
