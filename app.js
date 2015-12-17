var express = require('express');
var app = express();
var roomScript = require('./room.js');
var ArrayList = require('ArrayList');
var bodyParser = require('body-parser')
var roomList = new ArrayList();
var playerList = new ArrayList();
//ibm
// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
var cfenv = require('cfenv');
var appEnv = cfenv.getAppEnv();
var ibmbluemix = require('ibmbluemix');
var ibmpush = require('ibmpush');
var config = {
  applicationId:"05051db6-1eb5-4938-ac5e-82ca2b88e8c6",
  applicationRoute:"http://runrun.mybluemix.net",
  applicationSecret:"9f0b1a8fe49109913eed2c7154fbaec5a8d56168"
};
ibmbluemix.initialize(config);
var push = ibmpush.initializeService();

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());

app.get('/test',function(req,res){
	var message = {
		alert : "123",
		url : "https://www.facebook.com/"
	}
	var did=[{"consumerId" : "101212"},{"consumerId" : "6666666"}];
		
	push.sendNotificationByConsumerId(message,did).then(function(response) {
		console.log(response);
	},function(err) {
		console.log(err);
	});
	res.send('thanks');
});
app.post('/',function(req,res){
	res.send(req.body);
});
app.get('/',function(req,res){
	
	var date = new Date();
	var time = 30*60*1000;
	var d = new Date(date.valueOf()+time);	
	//res.send(randomString(6)+'</br>'+date.valueOf()+'   '+date.toLocaleString()+'</br>'+d.toLocaleString());
	res.send(playerList+'</br>'+roomList);
});
// Create new player on connected
// Add to PlayerList
app.post('/newPlayer',function(req,res){
	var fbId=req.body.fbId;
	var name=req.body.name;
	var bluetoothMac=req.body.bluetoothMac;
	var ingame=false;
	playerList.each(function(p){
		if(p.fdId==fbId&&p.room!=null){
			ingame=true;
		}		
	});	
	if(ingame){
		res.send('繼續遊戲');
	}else{
		var player = new Player(fbId,name,bluetoothMac);
		playerList.add(player);
		res.send('登入成功');
	}	
});
// ==================SERVER PROCESSING============================
// Implement chat in lobby feature		
// Basic Room function: create, join, leave, chat in room		
//CREATEROOM
app.post('/createroom',function(req,res){
	var exist = false;
	var result = false;
	do {
		var pinCode=randomString(6);
		roomList.each(function(r){
			if(r.pinCode===pinCode)
				exist=true;
		});	
	} while(exist);
	var hostfbId=req.body.hostfbId; //房長fbid
	var time = req.body.time;//遊戲時間(分鐘)
	var date = new Date();
	var host=null;
	playerList.each(function(p){
		if(p.fdId==hostfbId){
			host=p;
		}
	});
	var expireTime = new Date(date.valueOf()+time*60*1000);	//遊戲結束時間
	var room = new Room(host,time,expireTime,pinCode);
	roomList.add(room);
	playerList.each(function(p){
		if(p.fdId==hostfbId){
			if(p.joinRoom(pinCode)){
				p.isAdmin();
				p.Ready();
			}
		}
	});
	res.send(hostfbId+pinCode);
});
//CLOSEROOM
app.post('/closeroom',function(req,res){
	res.send('123');	
});
//JOINROOM
app.post('/joinroom',function(req,res){
	var fbId=req.body.fbId;
	var pinCode=req.body.pinCode;
	var result = false;
	playerList.each(function(p){
		if(p.fdId==fbId&&p.joinRoom(pinCode)){
			result=true;
		}		
	});
	res.send(result);
});
//LEAVEROOM
app.post('/leaveroom',function(req,res){
	var rusult=false;
	var fbId=req.body.fbId;
	playerList.each(function(p){
		if(p.fdId==fbId){
			p.leaveRoom();
			rusult=true;
		}		
	});
	res.send(rusult);
});
//CHATROOM
app.post('/chatroom',function(req,res){
	var message = {
		alert : req.body.msg
	}
	var did=[{"consumerId" : "101212"},{"consumerId" : "6666666"}];

	push.sendNotificationByConsumerId(message,did).then(function(response) {
		console.log(response);
	},function(err) {
		console.log(err);
	});
	res.send('success');
});
//PLAYER_READY PLAYER_CANCEL
app.post('/player',function(req,res){
	var action=req.query.action;
	var fbId=req.body.fbId;
	playerList.each(function(p){
		if(p.fdId==fbId){
			if(action=='ready') {
				p.Ready();
				res.send('ready');
			}else if(action=='cancel'){
				p.Cancel();
				res.send('cancel');
			}
		}
	});

});
//GAME_START GAME_FINISH
app.post('/game',function(req,res){
	var action=req.query.action;
	var hostfbId=req.body.hostfbId;
	roomList.each(function(r){
		if(action=="start"&&r.host.fbId==hostfbId&& r.IsReady){
			r.Play();
		}
	})

});

function Room(_host,_time,_expireTime,_pinCode){
	this.host = _host;
	this.time = _time;//遊戲時間
	this.pinCode = _pinCode;//房間pinCode
	this.expireTime= _expireTime;//遊戲結束時間
	this.players = new ArrayList();//房間玩家
	this.roomState = 'WAITING';//房間狀態
	this.broadCast = function(text)
	{
		var consumerId=[];
		var message = {
			alert : text
		}
		this.players.each(function(p){
			consumerId.push({"consumerId" : p.fbId});
		});			
		push.sendNotificationByConsumerId(message,consumerId).then(function(response) {
			console.log(response);
		},function(err) {
			console.log(err);
		});
	}
	// Switch state
	this.Wait = function()
	{
		this.roomState = "WAITING";
	}
	this.IsWaiting = function()
	{
		return (this.roomState == "WAITING");
	}
	
	this.Ready = function()
	{
		this.roomState = "READY";
	}
	this.IsReady = function()
	{
		return (this.roomState == "READY");
	}
	
	this.Play = function()
	{
		this.roomState = "PLAYING";
	}
	this.IsPlaying = function()
	{
		return (this.roomState == "PLAYING");
	}
	
	this.Finish = function()
	{
		this.roomState = "FINISHED";
	}
	this.IsFinished = function()
	{
		return (this.roomState == "FINISHED");
	}
	this.getStatus =  function()
	{
		var ready = true;
		this.players.each(function(p){
			if(!p.is_ready){
				this.ready();
			}else{
				this.Wait();
			}
		});
		var text=[{'ROOMSATUS':{'name':this.host.name,'status': this.host.is_ready,'gametime': this.time,'players':[]}}];
		this.players.each(function(p){
			text.players.push({name:p.name,status: p.is_ready,role: p.role});
		});
		return text;
	}
}

function Player(_fbId,_name,_bluetoothMac){
	this.fbId = _fbId;
	this.name = _name;
	this.bluetoothMac= _bluetoothMac;
	this.room = null;
	this.role = 1;//0-hunter 1-person 2-admin
	this.status = 0;//0-Alive 1-Dead
	this.deadReason = '';
	this.location=[];
	this.updatetime='';
	this.is_ready=false;
	this.init=function(){
		this.room=null;
		this.role = '1';//0-hunter 1-person
		this.status = '0';//0-Alive 1-Dead
		this.deadReason = '';
		this.location=[];
		this.updatetime= '';
		this.is_ready=false;		
	}
	this.Ready = function()
	{
		if (this.room != null)
		{
			this.is_ready = true;
			this.room.broadCast(r.getStatus());
		}
	}
	this.Cancel = function()
	{
		if (this.room != null)
		{
			this.is_ready = false;
			this.room.broadCast(r.getStatus());
		}		
	}
	this.isAdmin = function(){
		this.role = 2;
		this.room.broadCast(r.getStatus());
	}
	this.isPerson = function(){
		this.role = 1;
		this.room.broadCast(r.getStatus());
	}
	this.ishunter = function(){
		this.role = 0;
		this.room.broadCast(r.getStatus());
	}
	this.joinRoom = function(_pincode)
	{
		var cplayer = this;
		var roomExist = false;
		roomList.each(function(r){
			if (r.pinCode == _pincode)
			{
				roomExist = true;
				r.players.add(cplayer);
				cplayer.room = r;
				console.log("[!] " + cplayer.name + " joined room " + r.host.name);
				r.broadCast(r.getStatus());
				return true;
			}
		});
		if (roomExist == false)
		{
			return false;
		}
	}
	this.leaveRoom = function()
	{
		var cplayer = this;
		this.room.players.removeElement(this);
		this.room.broadCast(r.getStatus());
		cplayer.init();
	}
	
}

function randomString(len) {
　　len = len || 32;
　　var $chars = 'ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';    /****默認去掉了容易混淆的字元oOLl,9gq,Vv,Uu,I1****/
　　var maxPos = $chars.length;
　　var pwd = '';
　　for (i = 0; i < len; i++) {
　　　　pwd += $chars.charAt(Math.floor(Math.random() * maxPos));
　　}
　　return pwd;
}
var server = app.listen(appEnv.port,'0.0.0.0', function () {
	console.log("server starting on " + appEnv.url);
});