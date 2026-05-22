const Gantt = require("@dhtmlx/gantt-node").Gantt;
// import { Gantt } from "@dhtmlx/gantt-node";


const gantt = Gantt.getGanttInstance({
	config:{
		date_format: "%Y-%m-%d",
		columns: [
				{ name: "text", label: "Task name", width: 120, resize: true, tree: true },
				{ name: "start_date", label: "Start time", resize: true, width: 80 },
				{ name: "end_date", label: "End date", align: "center", resize: true, width: 80 },
				{ name: "duration", label: "Duration", resize: true, width: 50 },
				{
						name: "progress", label: "Progress", hide: true, width: 50, resize: true, align: "center", template: function (task) {
								return Math.round(task.progress * 100) + "%"
						}
				},
				{ name: "add", label: "", width: 44 }
		],
		// work_time: true,
		// skip_off_time: true
	},
	events: {
		onBeforeTaskDisplay: function(id, task){
			if (task.id == 4){
					return false;
			}
			return true;
		}
	},
	data: {
		tasks: [
			{ id: 100, text: "Project #1", type: "project", color: "green", parent: 0, open: true },
			{ id: 1, start_date: "2020-05-05 00:00", color: "blue", text: "Task #1", duration: 1, parent: 100, type: "task" },
			{ id: 2, start_date: "2020-05-05 00:00", color: "orange", text: "Task #2", duration: 3, parent: 100, type: "task" },
			{ id: 3, start_date: "2020-05-05 00:00", text: "Task #3", duration: 3, parent: 100, type: "task" },
			{ id: 4, start_date: "2020-05-15 00:00", text: "Task #4", duration: 3, parent: 100, type: "task" },
			{ id: 5, start_date: "2020-05-20 00:00", text: "Task #5", duration: 1, parent: 100, type: "task" }
		],
		links: [
			{ id: 1, source: 1, target: 2, type: "0" },
			{ id: 2, source: 2, target: 3, type: "0" },
			{ id: 3, source: 3, target: 4, type: "0" },
			{ id: 4, source: 4, target: 5, type: "0" },
			{ id: 5, source: 5, target: 6, type: "0" }
		]
	}
});

gantt.plugins({
   export_api: true,
});


gantt.config.columns[0].width = 120;

console.table(gantt.serialize().data);


const fs = require("fs");
const excelFile = fs.createReadStream('./demo.xlsx')
const mppFile = fs.createReadStream('./demo.mpp')
const p6File = fs.createReadStream('./demo.xer')

function importData (type, file){
	gantt[type]({
    data: file,
		// server: "http://localhost:3200/gantt",
		callback: function (data) {
			if (data) {
				console.log(data)
				if (type == "importFromExcel") return;
				gantt.clearAll();
				const project = JSON.parse(data)
				if (project.config.duration_unit) {
					gantt.config.duration_unit = project.config.duration_unit;
				}
				gantt.parse(project.data);

				console.table(gantt.serialize().data);
			}
		}
  });
}


function exportData(type, filename, serialize){
	const file = fs.createWriteStream(__dirname + '/' + filename);
	const exportConfig = {
		// server: "http://localhost:3200/gantt",
		data: serialize || undefined,
		callback: function(data){
			file.write(data);
			console.log("File ready: " + filename)
		}
	};
	if (type === "exportToExcel"){
		exportConfig.visual = true;
		exportConfig.raw = true;
	}
	gantt[type](exportConfig)
}




async function runTest(option){
	switch (option) {
		case "0":
			console.table(gantt.serialize().data)
			break;
		case "1":
			exportData("exportToPDF", 'gantt.pdf')
			break;
		case "2":
			exportData("exportToPNG", 'gantt.png')
			break;
		case "3":
			exportData("exportToExcel", 'gantt.xlsx')
			break;
		case "4":
			exportData("exportToICal", 'gantt.ical')
			break;
		case "5":
			exportData("exportToMSProject", 'gantt_msp.xml')
			break;
		case "6":
			exportData("exportToPrimaveraP6", 'gantt_p6.xml')
			break;
		case "7":
			importData ("importFromExcel", excelFile)
			break;
		case "8":
			importData ("importFromMSProject", mppFile)
			break;
		case "9":
			importData ("importFromPrimaveraP6", p6File)
			break;
	
		default:
			break;
	}
}



const readline = require("readline");

async function testMenu(){
	const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
	});

	const options = [
		`0. Show loaded tasks	\n`,
		`1. Export PDF	\n`,
		`2. Export PNG	\n`,
		`3. Export Excel	\n`,
		`4. Export iCal	\n`,
		`5. Export MSP	\n`,
		`6. Export Primaver P6	\n`,
		`7. Import Excel	\n`,
		`8. Import MSP	\n`,
		`9. Import Primavera P6	\n`,
	]

	console.log("Choose the functionality you want to test:");
	console.log(options.join(""))
	console.log("Type 'exit' to end testing")
	
	rl.question("", async function(option) {
		console.log("Selected option:", options[option]);
		rl.close();
		await runTest(option)

		if (option == "exit" || option == "'exit'"){
			process.exit(0);
		}
		await testMenu()
});

}
testMenu()
