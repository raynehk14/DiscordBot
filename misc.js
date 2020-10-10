'use strict';
const Misc = {
	roll: (sides)=>{
		if([4,6,8,10,20].indexOf(sides)<0) throw new Error('You can only roll a d4, d6, d8, d10 or d20!');
    return Math.round(Math.random()*sides);
	},
	flip: ()=>{
    return Math.round(Math.random()*2);
	}
}
module.exports = Misc;