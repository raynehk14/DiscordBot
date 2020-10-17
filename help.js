const Help = {
	list: {
		'flip':{
			command:'flip',
			desc:'Flip a coin',
		},
		'roll':{
			command:'roll [number of sides(optional, default: 6)]',
			desc:'Roll a dice (d4,d6,d8,d10,d20)\ne.g. \`${commandPrefix}roll 20\`',
		},
		'poll':{
			command:'poll [Title of your poll(optional)]: [option1], [option2], ...',
			desc:'Start a poll.  Use \`${commandPrefix}poll [option1], [options2], ...\` for polls with no title.\ne.g. \`${commandPrefix}poll Mia or Zoe?: Mia, Zoe\`',
		},
		'mine':{
			command:'mine [width(optional)] [height(optional)] [mine ratio/count(optional)]',
			desc:'Create a minesweeper board.  Default board is 5x5 with 5% mines, max size is 10x10.\ne.g. \`${commandPrefix}mine 10 10 15\` for 10x10 board with 15 mines\n\`${commandPrefix}mine 5 5 0.5\` for 5x5 board with 5% mines',
		},
		'youtube':{
			command:'youtube [query]',
			desc:'Search youtube for a video',
		},
		'wikia':{
			command:'wikia [wikia name]: [query]',
			desc:'Search wikia for an article\ne.g. \`${commandPrefix}wikia resident evil: claire redfield\`',
		},
		'twitch':{
			command:'twitch info [streamer name]',
			desc:'Check a twitch streamer\' current stream status',
		},
		'now':{
			command:'now [tz(optional)]',
			desc:'Current Local Time.  \nNote that query uses tz database/abbreviations so only cities/regions in the database would return a result.  Fallbacks to displaying server time.\ne.g. \`${commandPrefix}now new york\`, \`${commandPrefix}now est\`',
		},
		'timetill':{
			command:'timetill [time(YYYY-DD-MM hh:mm)], [tz]',
			desc:'Time till the input date.\ne.g. \`${commandPrefix}timetill 2049-10-03 20:49, los angeles\`',
		},
		'remindme':{
			command:'remindme [add|delete|list] [reminder name(optional)]: [time(YYYY-DD-MM hh:mm)|duration], [tz]',
			desc:'Set a reminder for yourself (via DM)\ne.g. \`${commandPrefix}remindme add Escape RC: 1998-10-30 10:00, CDT\`\n\`${commandPrefix}remindme add check the oven: 1 hour\`',
		},
		'custom':{
			command:'custom list',
			desc:'List of this server\'s custom commands',
		},
		'custom add':{
			command:'custom add [trigger phrase]: [message]',
			desc:'Create a custom command',
			mod:true,
		},
		'custom delete':{
			command:'custom delete [trigger phrase]',
			desc:'Delete a custom command',
			mod:true,
		},
		'custom prefix':{
			command:'custom prefix [on|off]',
			desc:'Turn on/off prefix for custom commands',
			mod:true,
		},
		'timetill [add|delete]':{
			command:'timetill [add|delete] [event name]: [time(YYYY-DD-MM hh:mm)], [tz]',
			mod:true,
		},
		'reminder':{
			command:'reminder',
			desc:'Set a reminder in this channel.  Uses the same arguments as \`remindme\`',
			mod:true,
		},
		'say':{
			command:'say [your message]',
			desc:'Have the bot say what you want to say instead',
			mod:true,
		},
		'role':{
			command:'role [add|delete|list|post]',
			desc:'Manage role assignments with bot.\ne.g.\`role add [roleId] [emoji(optional)]\`,\`role delete [roleId]\`',
			mod:true,
		},
		'role post':{
			command:'role post [new(optional)]',
			desc:'Post the role reaction post. If [new] is not provided, the current post(if exists) will be updated instead',
			mod:true,
		},
		'prefix':{
			command:'prefix [new command prefix]',
			desc:'Change the command prefix (default: \`!\`)',
			mod:true,
		},
	},
	pageLimit: 3,
	getPage:(page)=>{
		const list = Object.keys(Help.list);
		const start = page*Help.pageLimit;
		const end = (page+1)*Help.pageLimit;
		return list.slice(start,end).map(key=>Help.list[key]);
	},
	getPageCount:()=>Math.ceil(Object.keys(Help.list).length/Help.pageLimit),
	getCommand:(command)=>{
		return Help.list[command];
	},
	renderCommandUsage:(command,commandPrefix)=>{
		return `Usage: ${Help.renderHelp(Help.list[command],commandPrefix)})`;
	},
	renderHelp:(help,commandPrefix='!')=>{
		const {command,desc,mod} = help||{command:'',desc:''};
		return `\`${commandPrefix}${command}\`\n${mod?'(mod only) ':''}${(desc||'').replace(/\$\{commandPrefix\}/g,commandPrefix)}`;
	},
}
module.exports = Help;