'use strict';

const logger = require('./discordLogger');

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
		// logger.log(`[twitch] init`);
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
		// logger.log(`[twitch] init done`);
	}
	async findUser(twitchUserName){
		return await this.api.helix.users.getUserByName(twitchUserName);
	}
	async subscribeStreamChange(twitchUserNames,callback){
		// logger.log(`[twitch] twitchUserNames`, twitchUserNames);
		const users = await this.api.helix.users.getUsersByNames(twitchUserNames);
		if(users!=null){
			// logger.log(`[twitch] found ${Object.keys(users).length} users`);
			for(let i=0,username;username=Object.keys(users)[i];i++){
				const user = users[username];
				let prevStream = await user.getStream();
				// logger.log(`[twitch] subscribe to stream change for ${user.displayName} (currently: ${prevStream!=null?'live':'not live'})`);
				// await this.listener.subscribeToUserChanges(user, (user)=>{
				// 	logger.log(`[twitch] user change for ${user.displayName}`);
				// });
				// await this.listener.subscribeToFollowsToUser(user, async (follow)=>{
				// 	logger.log(`[twitch] user follow for ${(await follow.getFollowedUser()).displayName} from ${(await follow.getUser()).displayName}`);
				// });
				// await this.listener.subscribeToSubscriptionEvents(user, async (sub)=>{
				// 	logger.log(`[twitch] user sub for ${(await sub.getBroadcaster()).displayName} from ${(await sub.getUser()).displayName}`);
				// });
				const subscription = await this.listener.subscribeToStreamChanges(user, (stream)=>{
					logger.log(`[twitch] stream change for ${user.displayName}...`);
					if(stream){
						if(!prevStream){
							logger.log(`[twitch] ${stream.userDisplayName} just went live with title: ${stream.title}`);
							callback(user,stream);
						}
					}else{
						logger.log(`[twitch] ${user.displayName} just went offline`);
						callback(user,null);
					}
					prevStream = stream;
				});
				logger.log(`[twitch] subscribed to stream change (${subscription.id}) for ${user.displayName} (currently: ${prevStream!=null?'live':'not live'})`);
			}
		}
	}
	async unsubscribeStreamChange(twitchUserNames){
		logger.log('[bot] TODO unsubscribe',twitchUserNames);
	}
}

module.exports = Twitch;
