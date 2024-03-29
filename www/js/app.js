var found_my_device = false;
var connected = false;
var disconnect_requested = false;
var sharing = false;
var monitoring_temperature = false;
var odd = true;
var info_hidden = true;
var alert_level=0;
var rssi;
var proximity_band=3;       
var connection_timer;
var rssi_timer;
var btn_low;
var btn_mid;
var btn_high;
var cb_sharing=false;
var cb_temperature=false;
var rectangle;
var alarm_sound_path="sounds/alarm.wav";
var meshIDService ="00ff"; 

var app = {};
var device_addresses = [];
var selected_device_address;

app.device = {};
app.device.ADV_NAME = "ESP_GATTS_DEMO";

app.device.IMMEDIATE_ALERT_SERVICE = '1802';
app.device.LINK_LOSS_SERVICE       = '1803';
app.device.TX_POWER_SERVICE        = '1804';
app.device.PROXIMITY_MONITORING_SERVICE = '3e099910-293f-11e4-93bd-afd0fe6d1dfd';
app.device.HEALTH_THERMOMETER_SERVICE = '1809';

app.device.ALERT_LEVEL_CHARACTERISTIC   = '2a06';
app.device.TEMPERATURE_MEASUREMENT_CHARACTERISTIC   = '2a1C';
app.device.CLIENT_PROXIMITY_CHARACTERISTIC = '3e099911-293f-11e4-93bd-afd0fe6d1dfd';

app.findDevices = function() {
    app.clearDeviceList();
    app.startScan();
}

app.startScan = function()
{
    console.log("startScan");

    //TODO create onDeviceFound function
    function onDeviceFound(peripheral){
          console.log("找到设备："+peripheral.name);
        if(app.isMyDevice(peripheral.name)){
            found_my_device = true;
            app.showDiscoveredDevice(peripheral.id,peripheral.name);

        }

    }
    //TODO create scanFailure function
    function scanFailure(reason) {
    alert("扫描失败: "+JSON.stringify(reason));
    }
    //TODO start scanning for devices for 5 seconds
    ble.scan([], 5, onDeviceFound, scanFailure); 
    showMessage("扫描中....");

    //TODO check outcome of scanning after 5 seconds have elapsed using a timer
    setTimeout(function(){
        showMessage("");
        if(!found_my_device)
        alert("没有发现我的设备！");
    },5000);
};

app.isMyDevice = function(device_name)
{
    console.log("isMyDevice("+device_name+")");
    //TODO implement device name matching
    if(device_name == null|| device_name == undefined)
    {return false;}
    console.log('设备名：'+device_name);
    //蓝牙的过滤机制由这里实现
    return (device_name == app.device.ADV_NAME || device_name == "BDSK");
};

app.setAlertLevel = function(level) {
    //TODO implement function which writes to the Alert Level characteristic
    // in the Link Loss service
    console.log("设置警报等级("+level+")");
    var alert_level_bytes = [0x00];
    alert_level_bytes[0] = level;
    var alert_level_data = new Uint8Array(alert_level_bytes)
    ble.write(
    selected_device_address, 
    app.device.LINK_LOSS_SERVICE, 
    app.device.ALERT_LEVEL_CHARACTERISTIC, 
    alert_level_data.buffer, 
    function() {
    console.log("警报等级写入成功！");
    alert_level = level;
    app.setAlertLevelSelected();
    },
    function(e) {
    console.log("警报等级写入错误: "+e);
    });
};


app.toggleConnectionState = function() {
    console.log("toggleConnectionState("+selected_device_address+") : connected="+connected);
    //TODO implement code to toggle between connected and disconnected states
    if (!connected) {
        app.connectToDevice(selected_device_address);
        } else {
            console.log("断开连接中");
            ble.disconnect(
            selected_device_address,
            function() {
            console.log("改变连接状态: 断开连接状态OK");
            showInfo("已断开");
            connected = false;
            app.setControlsDisconnectedState();
            }, 
            function(error) {
            console.log("改变连接状态:断开连接失败: "+error);
            alert("断连失败");
            showInfo("错误：未能断连",2);
            });
        }

};

app.connectToDevice = function(device_address)
{
	console.log('connectToDevice: Connecting to '+device_address);
    //连接成功的操作
    function onConnected(peripheral)
    {
       console.log("连接到设备——>已连接");
       connected = true;
       //检查我们需要的服务
       if(app.hasService(peripheral,meshIDService) ||app.hasService(peripheral,app.device.IMMEDIATE_ALERT_SERVICE)){
        app.setControlsConnectedState();
        app.establishCurrentAlertLevel();
        showInfo("已连接",0);
        alert("已连接");
       }else{
        showInfo("错误，缺少我们需要的GATT服务",2);
        ble.disconnect(
            selected_device_address,
            function(){
                console.log("设备断开连接成功");
                showInfo("连接已断开");
            },
            function(error){
              console.log("连接到设备失败"+error);
              alert("错误：连接失败");
              showInfo("错误：连接失败",2);  
            }
        )
       }

    }
    //意外或者连接失败的操作
    function onDisconnected(peripheral)
    {
        console.log("连接到设备——>关闭连接");

        if (!connected) {
            // we tried to connect and failed
            console.log('连接到设备：错误！连接失败。');
            console.log(JSON.stringify(peripheral));
            showInfo("连接到设备：未连接",2);
            alert("错误：无法连接到所选设备");
            } else {
            // we were already connected and disconnection was unexpected
            showInfo("错误：未知状态的断开",2);
            }
            connected = false;
            app.setControlsDisconnectedState();
    }
   ble.connect(device_address, onConnected, onDisconnected);

};

app.establishCurrentAlertLevel = function() {
    console.log("获取当前的警报等级。");
    //TODO determine the Link Loss Alert Level that the BDSK device is currently set to
    ble.read(selected_device_address, app.device.LINK_LOSS_SERVICE, 
        app.device.ALERT_LEVEL_CHARACTERISTIC,function(data){
            console.log("读取当前的警报等级！");
            var alert_level_data = new Uint8Array(data);
            if (alert_level_data.length > 0) {
                console.log("警报等级="+alert_level_data[0]);
                alert_level = alert_level_data[0];
                app.setAlertLevelSelected();
            }
        },
        function(err) {
            console.log("错误，读取警报等级失败: "+err);
            })
}

app.exitMain = function() {
    if (connected) {
        showInfo("断开连接中");
        ble.disconnect(
        selected_device_address,
        function() {
        console.log("断连成功");
        app.showDeviceList();
        }, 
        function(error) {
        console.log("断连失败: "+error);
        alert("未能断开连接");
        app.showDeviceList();
        });
        } else {
        app.showDeviceList();
        }
};

app.showDiscoveredDevice = function(address, name) {
    console.log("showDiscoveredDevice("+address+","+name+")");
    var tbl = document.getElementById("tbl_devices");
    if (tbl != undefined) {
        var row_count = tbl.rows.length;
        var rows = tbl.rows;
        var new_row = tbl.insertRow(row_count);
        var new_cell = new_row.insertCell(0);
        var button_class;
        if (odd) {
            button_class = "wide_button_odd";
        } else {
            button_class = "wide_button_even";
        }
        odd = !odd;
        var btn_connect = "<button class=\""+button_class+"\" onclick=\"app.showMain('"+address+"')\" <br>"+name+"<br>"+address+"</button>";
        new_cell.innerHTML =  btn_connect;
    }
};

app.clearDeviceList = function() {
    var tbl = document.getElementById("tbl_devices");
    tbl.innerHTML = "";
}

app.showDeviceList = function() {
    device_list_hidden = false;
    main_hidden = true;
    message_hidden = false;
    setDivVisibility();
};

app.hasService = function(peripheral, service_uuid) {
    console.log("hasService("+JSON.stringify(peripheral)+","+service_uuid+")");
    var services = peripheral.services;
    for (var i=0;i<services.length;i++) {
        if (services[i].toLowerCase() == service_uuid) {
            return true;
        }
    }
    return false;
};

app.showMain = function(address) {
    console.log("showMain: "+address);
    selected_device_address = address;
    device_list_hidden = true;
    main_hidden = false;
    message_hidden = true;
    btn_low = document.getElementById("btn_low");
    btn_mid = document.getElementById("btn_mid");
    btn_high = document.getElementById("btn_high");
    document.getElementById('device_details').innerHTML = "Device:"+address+"";
    app.setControlsDisconnectedState();
    showInfo("Ready");
    setDivVisibility();
    document.getElementById('message').hidden = message_hidden;
};

app.initialize = function()
{   
	document.addEventListener(
		'deviceready',
		function() { 
          document.addEventListener("backbutton", app.onBackKeyDown, false);
          ready();
        },
		false);
};

app.onBackKeyDown = function() {
  if (main_hidden == false ) {
      app.exitMain();
      return;
  }
  if (device_list_hidden == false) {
      showMessage("Exiting application",2);
      setTimeout(function() { 
          navigator.app.exitApp(); 
        }, 
        500);
  }
};

app.setButtonText = function(btn_id,text) {
    console.log("setButtonText("+btn_id+","+text+")");
    var btn = document.getElementById(btn_id);
    btn.innerHTML = text;
};

app.disableButton = function(btn_id) {
    var btn = document.getElementById(btn_id);
 
};

app.enableButton = function(btn_id) {
    var btn = document.getElementById(btn_id);
    btn.style.color = "white";
}

app.setAlertLevelSelected = function() {
    switch (alert_level) {
        case 0:
          btn_low.style.color="#FF0000";
          btn_mid.style.color="#FFFFFF";
          btn_high.style.color="#FFFFFF";
          break;
        case 1:
          btn_low.style.color="#FFFFFF";
          btn_mid.style.color="#FF0000";
          btn_high.style.color="#FFFFFF";
          break;
        case 2:
          btn_low.style.color="#FFFFFF";
          btn_mid.style.color="#FFFFFF";
          btn_high.style.color="#FF0000";
          break;
    };
};

app.buttonIsDisabled = function(btn_id) {
    var btn = document.getElementById(btn_id);
    return (btn.style.color === "gray");
};

app.setControlsConnectedState = function() {
    console.log("setControlsConnectedState");
    app.setButtonText("btn_connect","断连");
    app.enableButton('btn_low');
    app.enableButton('btn_mid');
    app.enableButton('btn_high');
};

app.setControlsDisconnectedState = function() {
    console.log("setControlsDisconnectedState");
    app.setButtonText("btn_connect","连接");
    app.disableButton('btn_low');
    app.disableButton('btn_mid');
    app.disableButton('btn_high');
};

// Initialize the app.
app.initialize();
