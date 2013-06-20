var fs = require('fs');
var Path = require('path');
var through = require('through');
var FSError = require('./error').FSError;

function make_directories(dest, cb) {
	var dir = Path.dirname(dest);
	if (dir === '.' || dir === '..') return cb();
	fs.mkdir(dir, function(err) {
		if (err && err.code === 'ENOENT') {
			make_directories(dir, function() {
				fs.mkdir(dir, cb);
			})
		} else {
			cb();
		}
	});
}

function write(dest, data, cb) {
	var safe_write = function(cb) {
		fs.writeFile(dest, data, cb);
	}

	safe_write(function(err) {
		if (err && err.code === 'ENOENT') {
			make_directories(dest, function() {
				safe_write(cb);
			})
		} else {
			cb(err);
		}
	});
}

function write_stream(name) {
	var stream = through(function(data) {
		this.queue(data);
	}, function() {
		this.queue(null);
	});
	stream.pause();

	fs.exists(name, function(exists) {
		if (exists) return stream.emit('error', new FSError('EEXISTS'));

		var tmpname = name + '.tmp-'+String(Math.random()).replace(/^0\./, '');
		var file = fs.createWriteStream(tmpname);
		stream.on('data', function(data) {
			file.write(data);
		});
		stream.on('end', function() {
			fs.rename(tmpname, name, function(err) {
				if (err) stream.emit('error', err);
				stream.emit('close');
			});
		});
		stream.resume();
	});
	return stream;
}

function read_stream(name, stream, callback) {
	return fs.createReadStream(name);
}

function create(name, contents, callback) {
	fs.exists(name, function(exists) {
		if (exists) return callback(new FSError('EEXISTS'));
		write(name, contents, callback);
	});
}

function update(name, contents, callback) {
	fs.exists(name, function(exists) {
		if (!exists) return callback(new FSError('ENOENT'));
		write(name, contents, callback);
	});
}

function read(name, callback) {
	fs.readFile(name, callback);
}

function Storage(path) {
	this.path = path;
	try {
		fs.mkdirSync(path);
		console.log('created new packages directory: ', path);
	} catch(err) {
		if (err.code !== 'EEXIST') throw new Error(err);
	}
}

Storage.prototype.read = function(name, cb) {
	read(this.path + '/' + name, cb);
}

Storage.prototype.read_json = function(name, cb) {
	read(this.path + '/' + name, function(err, res) {
		if (err) return cb(err);
		cb(null, JSON.parse(res));
	});
}

Storage.prototype.create = function(name, value, cb) {
	create(this.path + '/' + name, value, cb);
}

Storage.prototype.create_json = function(name, value, cb) {
	create(this.path + '/' + name, JSON.stringify(value, null, '\t'), cb);
}

Storage.prototype.update = function(name, value, cb) {
	update(this.path + '/' + name, value, cb);
}

Storage.prototype.update_json = function(name, value, cb) {
	update(this.path + '/' + name, JSON.stringify(value, null, '\t'), cb);
}

Storage.prototype.write = function(name, value, cb) {
	write(this.path + '/' + name, value, cb);
}

Storage.prototype.write_json = function(name, value, cb) {
	write(this.path + '/' + name, JSON.stringify(value, null, '\t'), cb);
}

Storage.prototype.write_stream = function(name, value, cb) {
	return write_stream(this.path + '/' + name, value, cb);
}

Storage.prototype.read_stream = function(name, cb) {
	return read_stream(this.path + '/' + name, cb);
}

module.exports = Storage;
