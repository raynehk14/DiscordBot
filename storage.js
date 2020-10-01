'use strict';
const Database = require("@replit/database");
class Storage{
	constructor(){
		this.store = new Database();
	}
	async get(guild,key){
		const storeKey = getStoreKey(guild,key);
		return await this.store.get(storeKey);
	}
	async set(guild,key,value){
		const storeKey = getStoreKey(guild,key);
		return await this.store.set(storeKey,value);
	}
	async delete(guild,key){
		const storeKey = getStoreKey(guild,key);
		return await this.store.delete(storeKey);
	}
	async list(prefix){
		return await this.store.list(prefix);
	}

	// feature specific commands
	// twitch streamer subscriptions
	async getTwitchStreamers(guild){
		let twitchStreamers = [];
		try{
			const str = await this.get(guild,'twitch_streamers');
			twitchStreamers = JSON.parse(str||'[]');
		}catch(err){
			await this.set(guild,'twitch_streamers',JSON.stringify(twitchStreamers));
		}
		return twitchStreamers;
	}
	// custom command
	async getCustomCommand(guild,command){
		return await this.get(guild,`custom:${command}`);
	}
	async setCustomCommand(guild,command,message){
		return await this.set(guild,`custom:${command}`,message);
	}
	async deleteCustomCommand(guild,command){
		return await this.delete(guild,`custom:${command}`);
	}
	async listCustomCommands(guild){
		return (await this.list(getStoreKey(guild,'custom'))).map(key=>key.split(':')[2]);
	}
}
function getStoreKey(guild,key){
	// console.log(`[store] get key ${guild}, ${key}`);
	if(typeof guild=='object'){
		guild = guild.id||guild;
	}
	return `${guild}:${key}`;
}

module.exports = Storage;