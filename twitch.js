'use strict';

const { ApiClient } = require('twitch');
const { ClientCredentialsAuthProvider } = require('twitch-auth');
const { ReverseProxyAdapter, SimpleAdapter, WebHookListener } = require('twitch-webhooks');

const WEBHOOK_CB = process.env.WEBHOOK_CB;
const WEBHOOK_PORT = process.env.WEBHOOK_PORT;

function Twitch(appHost,app){
	this.appHost = appHost;
	this.app = app;
}

Twitch.prototype.init = async function(){
	console.log(`[twitch] init`);
	const authProvider = new ClientCredentialsAuthProvider(process.env.TWITCH_ID, process.env.TWITCH_SECRET);
	this.api = new ApiClient({authProvider,logLevel:'TRACE'});
	this.listener = new WebHookListener(this.api, new ReverseProxyAdapter({
		hostName: this.appHost,
		listenerPort: WEBHOOK_PORT,
		pathPrefix: WEBHOOK_CB,
	}),{logger:{minLevel:'TRACE'}});
	this.listener.applyMiddleware(this.app);
	console.log(`[twitch] init done`);
};
Twitch.prototype.listenToStreamChange = async function(twitchUserNames,callback){
	const users = await this.api.kraken.users.getUsersByNames(twitchUserNames);
	if(users!=null){
		console.log(`[twitch] found ${Object.keys(users).length} users`);
		for(let i=0,username;username=Object.keys(users)[i];i++){
			const user = users[username];
			let prevStream = await user.getStream();
			console.log(`[twitch] subscribe to stream change for ${user.displayName} (currently: ${prevStream!=null?'live':'not live'})`);
			const subscription = await this.listener.subscribeToStreamChanges(user, (stream)=>{
				console.log(`[twitch] stream change for ${user.displayName}...`);
				if(stream){
					if(!prevStream){
						console.log(`[twitch] ${stream.userDisplayName} just went live with title: ${stream.title}`);
						callback(stream,1);
					}
				}else{
					console.log(`[twitch] ${user.displayName} just went offline`);
					callback(stream,-1);
				}
				prevStream = stream;
			});
			console.log(`[twitch] subscribed to stream change for ${user.displayName}`, subscription.id);
		}
	}
}

module.exports = Twitch;