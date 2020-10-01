'use strict';

const express = require('express');
const path = require('path');
const morgan = require('morgan');
const Discord = require('discord.js');
const Twitch = require('./twitch');
const Storage = require('./storage');

const app = express();
const PORT = 3000;
const WEBHOOK_CB = process.env.WEBHOOK_CB;
const WEBHOOK_PORT = process.env.WEBHOOK_PORT;

const APP_HOST = 'discordbot.rayne14.repl.co';

app.use(morgan('combined'));
app.get('/', (req, res) => res.sendFile(path.join(__dirname+'/html/index.html')));
app.listen(PORT, () => console.log(`[main] discord bot app listening at http://localhost:${PORT}`));

// ================= START BOT CODE ===================
class Bot{
	constructor(app){
		this.app = app;
		this.client = new Discord.Client();
		this.storage = new Storage();
		this.session = {
			start: Date.now(),
		};

		this.client.on('ready', () => {
			console.log(`[bot] Logged in as ${this.client.user.tag}!`);
			this.init();
		});

		this.client.on('message', this.handleMessage.bind(this));
		this.client.login(process.env.DISCORD_TOKEN);
	}
	async init(){
		// start twitch 
		console.log(`[bot] storage keys`,(await this.storage.list()));
		this.initTwitch();
		// create channels if needed
		// this.initChannels();
	}
	async initTwitch(){
		this.twitch = new Twitch(APP_HOST,this.app);
		await this.twitch.init();
		this.client.guilds.cache.map(async guild=>{
			const twitchStreamers = await this.getTwitchStreamers(guild);
			await this.subscribeTwitchStreamChange(twitchStreamers,guild);
		});
	}
	async getTwitchStreamers(guild){
		let twitchStreamers = [];
		try{
			const str = await this.storage.get(guild.id,'twitch_streamers');
			twitchStreamers = JSON.parse(str);
		}catch(err){
			console.log(`[bot] twitch_streamers store not found or broken`,err);
			await this.storage.set(guild.id,'twitch_streamers',JSON.stringify(twitchStreamers));
		}
		return twitchStreamers;
	}
	async subscribeTwitchStreamChange(twitchStreamers,guild){
		await this.twitch.subscribeStreamChange(twitchStreamers,this.getTwitchStreamChangeHandler(guild));
	}
	async unsubscribeTwitchStreamChange(twitchStreamers,guild){
		await this.twitch.unsubscribeStreamChange(twitchStreamers);
	}
	getTwitchStreamChangeHandler(guild){
		return async function(stream,liveChange){
			console.log(`[bot] getTwitchStreamChangeHandler for guild ${guild.id}`);
			const channel = await this.findChannel(guild,'twitch_streams');
			switch(liveChange){
				case 1:
				channel.send(`${stream.userDisplayName} is going live!`);
				break;
				case -1:
				channel.send(`${stream.userDisplayName} is offline!`);
				break;
			}
		};
	}
	async initChannels(){
		this.client.guilds.cache.map(async guild=>{
			const botChannel = await this.findChannel(guild,'bot');
			const message = await botChannel.send('React for role');
			const colorRoles = {
				'red':'🔴',
				'orange':'🟠',
				'yellow':'🟡',
				'green':'🟢',
				'blue':'🔵',
				'violet':'🟣',
				'brown':'🟤',
			};
			Object.keys(colorRoles).map(key=>{
				message.react(colorRoles[key]);
			});
		});
	}
	async findChannel(guild,name){
		let channel = await guild.channels.cache.find((channel)=>channel.name.toLowerCase()==name);
		if(channel==null){
			console.log(`[bot] create ${name} channel`);
			channel = await guild.channels.create(name);
		}
		return channel;
	}
	async handleMessage(msg){
		const guild = msg.guild;
		const senderIsAdmin = msg.member.permissions.has(Discord.Permissions.MANAGE_SERVER);
		const isCommand = msg.content[0]=='!';
		if(isCommand){
			const args = msg.content.split(' ');
			switch(args[0]){
				case '!roles':
				if(senderIsAdmin){
					const roles = msg.guild.roles.cache.filter(role=>!role.name.startsWith('@')&&!role.managed&&!role.deleted);
					console.log(roles);
					msg.channel.send(`Roles: \n${roles.map(role=>role.name).join('\n')}`);
				}
				break;
				case '!achoo':
				msg.react('🤧');
				break;
				case '!twitch':
				let changed = false;
				const streamerNames = await this.getTwitchStreamers(guild);
				const streamerName = args[2];
				switch(args[1]){
					case 'list':
					msg.channel.send(`Twitch Streamers: \n${streamerNames.join('\n')}`);
					break;
					case 'add':
					if(streamerName&&streamerNames.indexOf(streamerName)<0){
						streamerNames.push(streamerName);
						this.subscribeTwitchStreamChange([streamerName],guild);
						changed = true;
						msg.channel.send(`Twitch Streamer added: ${streamerName}`);
					}else{
						msg.channel.send(`Twitch Streamer already on the list: ${streamerName}`);
					}
					break;
					case 'delete':
					if(streamerName&&streamerNames.indexOf(streamerName)>=0){
						streamerNames.splice(streamerNames.indexOf(streamerName),1);
						this.unsubscribeTwitchStreamChange([streamerName],guild);
						changed = true;
						msg.channel.send(`Twitch Streamer deleted: ${streamerName}`);
					}else{
						msg.channel.send(`Twitch Streamer is not on the list: ${streamerName}`);
					}
					break;
					case 'info':
					if(streamerName){
						const streamer = await this.twitch.findUser(streamerName);
						if(streamer){
							const channel = msg.channel;//await this.findChannel(guild,'twitch-streams');
							const stream = await streamer.getStream();
							const embed = new Discord.MessageEmbed({
								url: `https://twitch.tv/${streamer.name}`,
							});
							if(stream){
								embed.setTitle(stream.title);
								embed.setTimestamp(stream.startDate);
								embed.setThumbnail(streamer.profilePictureUrl.replace('{width}',600).replace('{height}',400));
								embed.setImage(stream.thumbnailUrl.replace('{width}',600).replace('{height}',400));
								channel.send(`${streamer.displayName} is live!`,embed);
							}else{
								channel.send(`${streamer.displayName} is currently offline!`,embed);
							}
						}else{
							channel.send(`${streamerName} not found!`);
						}
					}
					break;
				}
				if(changed){
					console.log(`[bot] twitch_streamers updated: ${JSON.stringify(streamerNames)}`);
					await this.storage.set(guild.id,'twitch_streamers',JSON.stringify(streamerNames));
				}
				break;
				case '!hurb':
				msg.channel.send(`Hurb`);
				break;
			}
		}
	}
}

const bot = new Bot(app);