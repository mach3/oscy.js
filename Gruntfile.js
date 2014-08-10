
module.exports = function(grunt){

	var banner = grunt.template.process(
		grunt.file.read("src/banner.js"),
		{data: grunt.file.readJSON("package.json")}
	);

	console.log(banner);

	grunt.initConfig({
		connect: {
			dev: {
				options: {
					base: "./",
					port: 8080,
					keepalive: true
				}
			}
		}
	});

	grunt.registerTask("default", []);
	grunt.registerTask("build", ["concat:build", "uglify:build"]);
	grunt.registerTask("dev", ["connect"])

	grunt.loadNpmTasks("grunt-contrib-connect");
	grunt.loadNpmTasks("grunt-contrib-concat");
	grunt.loadNpmTasks("grunt-contrib-uglify");

};
