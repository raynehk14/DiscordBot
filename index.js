'use strict';

const express = require('express');
const path = require('path');
const morgan = require('morgan');
const Discord = require('discord.js');
const Twitch = require('./twitch');
const Store = require('./store');

const app = express();
const PORT = 3000;
const WEBHOOK_CB = process.env.WEBHOOK_CB;
const WEBHOOK_PORT = process.env.WEBHOOK_PORT;

const APP_HOST = 'discordbot.rayne14.repl.co';

app.use(morgan('combined'));
app.get('/', (req, res) => res.sendFile(path.join(__dirname+'/html/index.html')));
app.listen(PORT, () => console.log(`[main] discord bot app listening at http://localhost:${PORT}`));

// ================= START BOT CODE ===================
function Bot(app){
	this.app = app;
	this.client = new Discord.Client();
	this.store = new Store();
	this.session = {
		start: Date.now(),
	};

	this.client.on('ready', () => {
		console.log(`[bot] Logged in as ${this.client.user.tag}!`);
		this.init();
	});

	this.client.on('message', msg => {
		switch(msg.content){
			case '.roles':
			if(msg.member.permissions.has(Discord.Permissions.MANAGE_ROLES)){
				const roles = msg.guild.roles.cache.filter(role=>!role.name.startsWith('@')&&!role.managed&&!role.deleted);
				console.log(roles);
				msg.channel.send(`Roles: \n${roles.map(role=>role.name).join('\n')}`);
			}
			break;
		}
		if (msg.content === 'ping') {
			msg.react('🤧');
		}
	});
	this.client.login(process.env.DISCORD_TOKEN);
}

Bot.prototype.init = async function(){
	// start twitch 
	this.initTwitch();
	// create channels if needed
	// this.initChannels();
};
Bot.prototype.initTwitch = async function(){
	const t = this.twitch = new Twitch(APP_HOST,this.app);
	await t.init();
	this.client.guilds.cache.map(async guild=>{
		const twitchUserNames = [];
		try{
			const json = JSON.parse(this.store.get(guild.id,'twitch_stream_changes'));
			twitchUserNames.concat(json);
		}catch(err){
			console.log(`[bot] twitch_stream_changes store not found or broken`)
		}
		await t.listenToStreamChange(twitchUserNames,this.getTwitchStreamChangeHandler(this));
	});
};
Bot.prototype.getTwitchStreamChangeHandler = function(guild){
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
};
Bot.prototype.initChannels = async function(){
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
};
Bot.prototype.findChannel = async function(guild,name){
	let channel = await guild.channels.cache.find((channel)=>channel.name.toLowerCase()==name);
	if(channel==null){
		console.log(`[bot] create ${name} channel`);
		channel = await guild.channels.create(name);
	}
	return channel;
};

const bot = new Bot(app);
