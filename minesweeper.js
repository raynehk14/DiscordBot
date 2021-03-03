'use strict';
class Minesweeper {
	mineAdjIcons = ['0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'];
	mineIcon = '💥';
	mineCharacter = 'x';
	rowMax = 10;
	colMax = 10;
	// 8x8, 10% mine ratio 
	constructor(row=8,col=8,mineRatioOrCount=0.10){
		// console.log(`new board ${row}x${col}`);
		this.row = Math.min(this.rowMax,row); this.col = Math.min(this.colMax,col);
		if(mineRatioOrCount>1){
			this.mineCount = parseInt(mineRatioOrCount);
		}else{
			mineRatioOrCount = Math.min(.9,mineRatioOrCount); 
			this.mineCount = Math.ceil(this.row*this.col*mineRatioOrCount);
		}
		this.board = new Array(this.col).fill(0).map((r,i)=>{
			return new Array(this.row).fill(0);
		});
		this.mineCount = Math.min(this.row*this.col-1,this.mineCount);
		// init mines
		let minesDeployed = 0;
		while(minesDeployed<this.mineCount){
			const mineX = Math.floor(this.row*Math.random());
			const mineY = Math.floor(this.col*Math.random());
			// check if target is already a mine
			if(this.board[mineY][mineX]==this.mineCharacter) continue;
			// else, set to mine
			// console.log(`Deploying mine ${minesDeployed}/${this.mineCount}`);
			this.board[mineY][mineX] = this.mineCharacter;
			minesDeployed++;
		}
	}
	render(){
		const strBuffer = [];
		this.board.map((col,y)=>{
			this.board[y].map((row,x)=>{
				const adj = this.findAdjacentMineCount(x,y);
				const icon = this.getMineIcon(adj);
				strBuffer.push(`||${icon}|| `);
			});
			strBuffer.push('\n');
		});
		const title = `Minesweeper!  ${this.row}x${this.col} (||${this.mineCount}|| mines)\n`;
		return title+strBuffer.join('');
	}
	getMineIcon(count){
		if(count==this.mineCharacter) return this.mineIcon;
		return this.mineAdjIcons[count];
	}
	isMine(x,y){
		return this.board[y]&&this.board[y][x]&&this.board[y][x]==this.mineCharacter;
	}
	findAdjacentMineCount(x,y){
		if(this.isMine(x,y)) return this.mineCharacter;
		let count = 0;
		let edges = {top:y<=0,left:x<=0,right:x>=this.row-1,bottom:y>=this.col-1};
		// n
		if(!edges.top&&this.isMine(x,y-1)) count++;
		// ne
		if(!edges.top&&!edges.right&&this.isMine(x+1,y-1)) count++;
		// e
		if(!edges.right&&this.isMine(x+1,y)) count++;
		// se
		if(!edges.right&&!edges.bottom&&this.isMine(x+1,y+1)) count++;
		// s
		if(!edges.bottom&&this.isMine(x,y+1)) count++;
		// sw
		if(!edges.bottom&&!edges.left&&this.isMine(x-1,y+1)) count++;
		// w
		if(!edges.left&&this.isMine(x-1,y)) count++;
		// nw
		if(!edges.top&&!edges.left&&this.isMine(x-1,y-1)) count++;
		return count;
	}
}

module.exports = Minesweeper;