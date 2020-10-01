'use strict';

const { ApiClient } = require('twitch');
const { ClientCredentialsAuthProvider } = require('twitch-auth');
const { ReverseProxyAdapter, SimpleAdapter, WebHookListener } = require('twitch-webhooks');

const WEBHOOK_CB = process.env.WEBHOOK_CB;
const WEBHOOK_PORT = process.env.WEBHOOK_PORT;

class Twitch{
	constructor(appHost,app){
		this.appHost = appHost;
		this.app = app;
	}
	async init(){
		console.log(`[twitch] init`);
		const authProvider = new ClientCredentialsAuthProvider(process.env.TWITCH_ID, process.env.TWITCH_SECRET);
		this.api = new ApiClient({
			authProvider,
			logLevel:'WARNING'
		});
		this.listener = new WebHookListener(this.api, new ReverseProxyAdapter({
			hostName: this.appHost,
			listenerPort: WEBHOOK_PORT,
			pathPrefix: WEBHOOK_CB,
		}),{
			logger:{minLevel:'WARNING'}
		});
		this.listener.applyMiddleware(this.app);
		console.log(`[twitch] init done`);
	}
	async findUser(twitchUserName){
		return await this.api.helix.users.getUserByName(twitchUserName);
	}
	async subscribeStreamChange(twitchUserNames,callback){
		// console.log(`[twitch] twitchUserNames`, twitchUserNames);
		const users = await this.api.helix.users.getUsersByNames(twitchUserNames);
		if(users!=null){
			console.log(`[twitch] found ${Object.keys(users).length} users`);
			for(let i=0,username;username=Object.keys(users)[i];i++){
				const user = users[username];
				let prevStream = await user.getStream();
				// console.log(`[twitch] subscribe to stream change for ${user.displayName} (currently: ${prevStream!=null?'live':'not live'})`);
				// await this.listener.subscribeToUserChanges(user, (user)=>{
				// 	console.log(`[twitch] user change for ${user.displayName}`);
				// });
				// await this.listener.subscribeToFollowsToUser(user, async (follow)=>{
				// 	console.log(`[twitch] user follow for ${(await follow.getFollowedUser()).displayName} from ${(await follow.getUser()).displayName}`);
				// });
				// await this.listener.subscribeToSubscriptionEvents(user, async (sub)=>{
				// 	console.log(`[twitch] user sub for ${(await sub.getBroadcaster()).displayName} from ${(await sub.getUser()).displayName}`);
				// });
				const subscription = await this.listener.subscribeToStreamChanges(user, (stream)=>{
					console.log(`[twitch] stream change for ${user.displayName}...`);
					if(stream){
						if(!prevStream){
							console.log(`[twitch] ${stream.userDisplayName} just went live with title: ${stream.title}`);
							callback(user,stream);
						}
					}else{
						console.log(`[twitch] ${user.displayName} just went offline`);
						callback(user,null);
					}
					prevStream = stream;
				});
				console.log(`[twitch] subscribed to stream change (${subscription.id}) for ${user.displayName} (currently: ${prevStream!=null?'live':'not live'})`);
			}
		}
	}
	async unsubscribeStreamChange(twitchUserNames){
		console.log('[bot] TODO unsubscribe',twitchUserNames);
	}
}

module.exports = Twitch;
