var Accessory = require('../').Accessory;
var Service = require('../').Service;
var Characteristic = require('../').Characteristic;
var uuid = require('../').uuid;
var request = require('sync-request');

console.log('Connecting to MQTT...')
var mqtt = require('mqtt');
var options = {
  port: 1883,
  host: '10.0.1.17',
  clientId: 'raspbi'
};
var client = mqtt.connect(options);
console.log('MQTT successfully connected!');

console.log('Fetching devices...')
var res = request('GET', 'http://localhost:5000/devices.json')
var json = JSON.parse(res.getBody('utf8'));
console.log('Received ' + json.length + ' devices');

var accessories = [];

for (var i = 0; i < json.length; i++) {
  var obj = json[i];

  var uuid_seed = 'hap-nodejs:accessories:' + obj.name + ':' + obj.pk + ':' + obj.channel
  var accessory = new Accessory(obj.name, uuid.generate(uuid_seed));

  accessory.username = obj.username;
  accessory.pincode = obj.pinCode;

  accessory
    .getService(Service.AccessoryInformation)
    .setCharacteristic(Characteristic.Manufacturer, obj.manufacturer)
    .setCharacteristic(Characteristic.Model, obj.model)
    .setCharacteristic(Characteristic.SerialNumber, obj.serial_number);

  accessory
    .on('identify', function(paired, callback) {
      console.log(obj.name + ' identified.');
      callback();
    });

  accessory
    .addService(Service.Switch, obj.name)
    .getCharacteristic(Characteristic.On)
    .on('set', function(value, callback) {
      console.log('Setting state to ' + value + ' for ' + obj.name + '.');
      request('POST', 'http://localhost:5000/devices/save_state/' + obj.pk, {
        json: { 'state': value ? 1 : 0 }
      });

      console.log('Sending IR sequence to ' + obj.channel);
      console.log(obj.sequence);
      client.publish(obj.channel, obj.sequence);

      callback();
    })
    .on('get', function(callback) {
      var state_res = request('GET', 'http://localhost:5000/devices/state/' + obj.pk)
      var state = JSON.parse(state_res.getBody('utf8')).state;
      console.log('Getting state ' + state + ' for ' + obj.name + '.');
      callback(null, state == 1);
    });

  accessories.push(accessory);
}

console.log(accessories.length + ' devices successfully configured!');

exports.accessories = accessories;
