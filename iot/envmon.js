var awsIot = require('aws-iot-device-sdk');
var MA = require('moving-average');
var sensorLib = require('node-dht-sensor');

var sendInterval = 60 * 1000; // 1 minute
var sensorInterval = 2 * 1000; // 2 seconds

var maTemp = MA(sendInterval);
var maHumi = MA(sendInterval);
var operationCallbacks = {};

// config
var deviceName = "rpi1";
var args = {
  privateKey: '/home/pi/aws_certs/privateKey.pem',
  clientCert: '/home/pi/aws_certs/cert.pem',
  caCert: '/home/pi/aws_certs/rootCA.crt',
  clientId: deviceName,
  region: 'eu-west-1',
  reconnectPeriod: 10000,
  debug: true
}



initIot(args);

function initIot(args) {

  const thingShadows = awsIot.thingShadow({
    keyPath: args.privateKey,
    certPath: args.clientCert,
    caPath: args.caCert,
    clientId: args.clientId,
    region: args.region,
    reconnectPeriod: args.reconnectPeriod,
    debug: args.debug
  });

  var sensor = initSensor()
  if (sensor.initialize()) {
    sensor.read();
  } else {
    console.warn('Failed to initialize sensor');
  }
};

// IoT callbacks
thingShadows
  .on('connect', function() {
    console.log('connected to things instance, registering thing name');


    thingShadows.register(deviceName);

    var opFunction = function() {

      var clientToken;

      clientToken = thingShadows.get(deviceName);
      operationCallbacks[clientToken] = {
        operation: 'get',
        cb: null
      };

      operationCallbacks[clientToken].cb =
        function(deviceName, operation, statusType, stateObject) {
          console.log(role + ':' + operation + ' ' + statusType + ' on ' + deviceName + ': ' + JSON.stringify(stateObject));
        };

      setState(thingShadows);
    };
    // An update right away causes a timeout error, so we wait about 2 seconds
    setTimeout(function() {
      opFunction();
    }, 2500);
  });
thingShadows
  .on('close', function() {
    console.log('close');
    thingShadows.unregister(deviceName);
  });
thingShadows
  .on('reconnect', function() {
    console.log('reconnect');
    thingShadows.register(deviceName);
  });
thingShadows
  .on('offline', function() {
    console.log('offline');
  });
thingShadows
  .on('error', function(error) {
    console.log('error', error);
  });
thingShadows
  .on('message', function(topic, payload) {
    console.log('message', topic, payload.toString());
  });
thingShadows
  .on('status', function(deviceName, stat, clientToken, stateObject) {
    if (!isUndefined(operationCallbacks[clientToken])) {
      setTimeout(function() {
        operationCallbacks[clientToken].cb(deviceName, operationCallbacks[clientToken].operation, stat, stateObject);
        delete operationCallbacks[clientToken];
      }, 2000);
    } else {
      console.warn('status:unknown clientToken \'' + clientToken + '\' on \'' + deviceName + '\'');
    }
  });
//
// Only the simulated device is interested in delta events.
//
thingShadows
  .on('delta', function(deviceName, stateObject) {
    console.log(role + ':delta on ' + deviceName + ': ' + JSON.stringify(stateObject));

  });

thingShadows
  .on('get', function(deviceName, stateObject) {
    console.log(role + ':get on ' + deviceName + ': ' + JSON.stringify(stateObject));

  });

thingShadows
  .on('timeout', function(deviceName, clientToken) {
    if (!isUndefined(operationCallbacks[clientToken])) {
      operationCallbacks[clientToken].cb(deviceName, operationCallbacks[clientToken].operation, 'timeout', {});
      delete operationCallbacks[clientToken];
    } else {
      console.warn('timeout:unknown clientToken \'' + clientToken + '\' on \'' + deviceName + '\'');
    }
  });
}

function setState(thingShadows) {
  var temp = String(maTemp.movingAverage());
  var humidity = String(maHumi.movingAverage());
  console.log("Reporting average: temp:" + temp + " humidity:" + humidity);

  reported_state = {
    temperature: temp,
    humidity: humidity
  };
  device_state = {
    state: {
      reported: reported_state
    }
  };
  thingShadows.update(deviceName, device_state);
  console.log("command state updated:" + JSON.stringify(device_state));

  setTimeout(function() {
    setState(thingShadows);
  }, sendInterval);
}

function isUndefined(value) {
  if ((typeof(value) === 'undefined') || (typeof(value) === null)) {
    return true;
  }
  return false;
}

function initSensor() {
  return {
    initialize: function() {
      return sensorLib.initialize(11, 4); //DHT11 on pin 4
    },
    read: function() {
      let readout = sensorLib.read();
      let temperature = readout.temperature.toFixed(2);
      let humidity = readout.humidity.toFixed(2);
      console.log('Temperature: ' + temperature + ' C, ' + 'humidity: ' + humidity + ' %');

      maTemp.push(Date.now(), readout.temperature.toFixed(2));
      maHumi.push(Date.now(), readout.humidity.toFixed(2));

      setTimeout(function() {
        sensor.read();
      }, sensorInterval);
    }
  }
