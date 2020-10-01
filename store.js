'use strict';
const Database = require("@replit/database");
function Store(){
	this.store = new Database();
}
Store.prototype.get = async function(server,key){
	const storeKey = getStoreKey(server,key);
	return await this.store.get(storeKey);
};
Store.prototype.set = async function(server,key,value){
	const storeKey = getStoreKey(server,key);
	return await this.store.set(storeKey,value);
};
Store.prototype.delete = async function(server,key){
	const storeKey = getStoreKey(server,key);
	return await this.store.delete(storeKey);
};
Store.prototype.list = async function(prefix){
	return await this.store.list(prefix);
};

function getStoreKey(server,key){
	return `${server}:${key}`;
}

module.exports = Store;