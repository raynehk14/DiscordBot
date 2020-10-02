'use strict';
const Database = require("@replit/database");
class Storage{
	constructor(){
		this.storage = new Database();
	}
	async get(guild,key){
		const storeKey = getStoreKey(guild,key);
		return await this.storage.get(storeKey);
	}
	async set(guild,key,value){
		const storeKey = getStoreKey(guild,key);
		return await this.storage.set(storeKey,value);
	}
	async delete(guild,key){
		const storeKey = getStoreKey(guild,key);
		return await this.storage.delete(storeKey);
	}
	async list(prefix){
		return await this.storage.list(prefix);
	}
	async deleteWithPrefix(prefix){
		const keys = await this.storage.list(prefix);
		keys.map(key=>{
			// console.log(`[storage] deleting key ${key}`);
			this.storage.delete(key);
		});
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
	// role assignments
	async getRoleAssignment(guild,roleId){
		let roleMap = {};
		try{
			const str = await this.get(guild,'roles');
			roleMap = JSON.parse(str||'{}');
		}catch(err){
			await this.set(guild,'roles',JSON.stringify(roleMap));
		}
		return roleMap;
	}
	async getRoleAssignmentByEmoji(guild,emoji){
		// console.log(`[store] get emoji`,emoji);
		const roleMap = await this.getRoleAssignment(guild,'roles');
		for(let i=0,roleId;roleId=Object.keys(roleMap)[i];i++){
			const roleEmoji = roleMap[roleId];
			// console.log('[store] compare role emojis:',emoji.id,emoji.name,roleEmoji);
			if(roleEmoji==emoji.id||roleEmoji==emoji.name||roleEmoji==`<:${emoji.name}:${emoji.id}>`){
				return await guild.roles.fetch(roleId);
			}
		}
		return null;
	}
	async addRoleAssignment(guild,roleId,emoji){
		const roleMap = await this.getRoleAssignment(guild,'roles');
		roleMap[roleId] = emoji||false;
		return await this.set(guild,'roles',JSON.stringify(roleMap));
	}
	async deleteRoleAssignment(guild,roleId){
		const roleMap = await this.getRoleAssignment(guild,'roles');
		delete roleMap[roleId];
		return await this.set(guild,'roles',JSON.stringify(roleMap));
	}
	async listRoleAssignments(guild){
		const roleMap = await this.getRoleAssignment(guild,'roles');
		const roleList = [];
		for(let i=0,roleId;roleId=Object.keys(roleMap)[i];i++){
			roleList.push({
				roleId:roleId,
				role:await guild.roles.fetch(roleId),
				emoji:roleMap[roleId]
			});
		}
		return roleList;
	}
	async getRoleAssignmentMessage(guild){
		const value = await this.get(guild,'roleMessage');
		return (value||'').split(':');
	}
	async setRoleAssignmentMessage(guild,channelId,messageId){
		return await this.set(guild,'roleMessage',`${channelId}:${messageId}`);
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