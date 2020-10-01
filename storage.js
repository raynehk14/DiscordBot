'use strict';
const Database = require("@replit/database");
class Storage{
	constructor(){
		this.store = new Database();
	}
	async get(server,key){
		const storeKey = getStoreKey(server,key);
		return await this.store.get(storeKey);
	}
	async set(server,key,value){
		const storeKey = getStoreKey(server,key);
		return await this.store.set(storeKey,value);
	}
	async delete(server,key){
		const storeKey = getStoreKey(server,key);
		return await this.store.delete(storeKey);
	}
	async list(prefix){
		return await this.store.list(prefix);
	}
}
function getStoreKey(server,key){
	// console.log(`[store] get key ${server}, ${key}`);
	return `${server}:${key}`;
}

module.exports = Storage;