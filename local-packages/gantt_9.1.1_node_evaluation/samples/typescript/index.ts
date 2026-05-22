import { Gantt } from "@dhx/gantt-node";

const gantt = Gantt.getGanttInstance({
	plugins:{
		auto_scheduling: true,
	},
	config: {
		work_time: true,
		duration_unit: "hour",
		auto_scheduling:{
			enabled: true,
			move_asap_tasks: true,
			schedule_on_parse: false,
			mode: "constraints",
		}
	},
	data: {
		tasks: [
			{ id: 1, text: "Project #1", type: "project", parent: 0 },
			{ id: 2, start_date: "05-04-2020 00:00", text: "Task #1", duration: 1, parent: 1, type: "task" },
			{ id: 3, start_date: "05-04-2020 00:00", text: "Task #2", duration: 3, parent: 1, type: "task" },
			{ id: 4, start_date: "05-04-2020 00:00", text: "Task #3", duration: 3, parent: 1, type: "task" },
			{ id: 5, start_date: "05-04-2020 00:00", text: "Task #4", duration: 3, parent: 1, type: "task" },
			{ id: 6, start_date: "05-04-2020 00:00", text: "Task #5", duration: 1, parent: 1, type: "task" }
		],
		links: [
			{ id: 1, source: 1, target: 2, type: "0" },
			{ id: 2, source: 2, target: 3, type: "0" },
			{ id: 3, source: 3, target: 4, type: "0" },
			{ id: 4, source: 4, target: 5, type: "0" },
			{ id: 5, source: 5, target: 6, type: "0" }
		]
	},
	events:{
		onAfterAutoSchedule: function(taskId, updatedTasks) {
			console.log("Following tasks were auto scheduled:");
			console.table(updatedTasks.map((taskId) => {
				return {
					id: taskId,
					text: this.getTask(taskId).text
				};
			}));
		},
		onParse: function() {
			console.log("Loaded data:")
			console.table(this.serialize().data);
		},
		onGanttReady: () => {
			console.log("Running dhtmlxGantt on the backend");
		}
	}
});


console.log("Auto schedule:");

gantt.autoSchedule();

console.log("After auto scheduling:");
console.table(gantt.serialize().data);