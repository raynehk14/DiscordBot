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
		const t = this.twitch = new Twitch(APP_HOST,this.app);
		await t.init();
		this.client.guilds.cache.map(async guild=>{
			const twitchStreamers = this.getTwitchStreamers(guild);
			await t.listenToStreamChange(twitchStreamers,this.getTwitchStreamChangeHandler(this));
		});
	}
	async getTwitchStreamers(guild){
		const twitchStreamers = [];
		try{
			const str = await this.storage.get(guild.id,'twitch_streamers');
			console.log(`[bot] twitch_streamers store raw:`,str);
			const json = JSON.parse(str);
			twitchStreamers.push(...json);
		}catch(err){
			console.log(`[bot] twitch_streamers store not found or broken`,err);
			await this.storage.set(guild.id,'twitch_streamers',JSON.stringify(twitchStreamers));
		}
		return twitchStreamers;
	}
	getTwitchStreamChangeHandler(guild){
		return async function(stream,liveChange){
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
	handleMessage(msg){
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
				const streamers = this.getTwitchStreamers(guild);
				const streamer = args[2];
				switch(args[1]){
					case 'list':
					msg.channel.send(`Twitch Streamers: ${streamers}`);
					break;
					case 'add':
					if(streamer&&streamers.indexOf(streamer)<0){
						streamers.push(streamer);
						changed = true;
						msg.channel.send(`Twitch Streamer added: ${streamer}`);
					}else{
						msg.channel.send(`Twitch Streamer already on the list: ${streamer}`);
					}
					break;
					case 'delete':
					if(streamer&&streamers.indexOf(streamer)>=0){
						streamers.splice(streamers.indexOf(streamer),1);
						changed = true;
						msg.channel.send(`Twitch Streamer deleted: ${streamer}`);
					}else{
						msg.channel.send(`Twitch Streamer is not on the list: ${streamer}`);
					}
					break;
				}
				if(changed){
					console.log(`[bot] twitch_streamers updated: ${JSON.stringify(streamers)}`);
					this.storage.set(guild,'twitch_streamers',JSON.stringify(streamers));
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