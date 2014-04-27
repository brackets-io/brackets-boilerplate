/*jshint browser:true, jquery:true */
/*global define, brackets */

/**
 * Brackets Boilerplate
 */
define(function (require, exports, module) {
  "use strict";
  var PreferencesManager  = brackets.getModule("preferences/PreferencesManager"),
      // CommandManager      = brackets.getModule("command/CommandManager"),
      // Menus               = brackets.getModule("command/Menus"),
      ProjectManager      = brackets.getModule("project/ProjectManager"),
      DropdownButton      = brackets.getModule("widgets/DropdownButton").DropdownButton,
      FileSystem          = brackets.getModule("filesystem/FileSystem"),

      prefs           = PreferencesManager.getExtensionPrefs("brackets-boilerplate"),
      boilerDropdown,
      boilerplateDir  = null;

  function init() {
    prefs.definePreference("boilerplateDir", "string");
    prefs.on("change", function(){
      if (boilerplateDir !== prefs.get("boilerplateDir")) {
        boilerplateDir = prefs.get("boilerplateDir");
        makeList();
      }
    });

    boilerDropdown = new DropdownButton("New...", ["Set boilerplate folder..."]);
    boilerDropdown.$button.appendTo("#project-files-header");
    $("#project-files-header").css("white-space", "normal");
    $(boilerDropdown).on("select", onSelect);
  }

  function makeList() {
    var list = [], dir, i, name;
    if (boilerplateDir) {
      // TODO actually make the list...
      dir = FileSystem.getDirectoryForPath(boilerplateDir);
      dir.getContents(function(err, entries){
        for(i=0;i<entries.length;i++) {
          name = entries[i].fullPath;
          name = name.substr(name.lastIndexOf("/", name.length-2)+1);
          list.push(name);
        }
        list.push("Set boilerplate folder...");
      });
    } else {
      list.push("Set boilerplate folder...");
    }
    boilerDropdown.items = list;
  }

  function onSelect(button, item, index) {
    var source, dest, q, name, suffix;

    makeList();
    // find and set destination folder
    if (ProjectManager.getSelectedItem()) {
      if (ProjectManager.getSelectedItem().isDirectory) {
        dest = ProjectManager.getSelectedItem().fullPath;
      } else {
        dest = ProjectManager.getSelectedItem().parentPath;
      }
    } else {
      dest = ProjectManager.getProjectRoot().fullPath;
    }
    if (item.substr(-3) === "...") {
      // Select source folder
      FileSystem.showOpenDialog(false, true, "Chose boilerplate folder", boilerplateDir, null, function(err, entries){
        if (entries.length > 0) {
          source = FileSystem.getDirectoryForPath(entries[0]);
          prefs.set("boilerplateDir", source.fullPath);
          prefs.save();
        }
      });
    } else {
      // Get source
      if (item.substr(-1) === "/") {
        source  = FileSystem.getDirectoryForPath(boilerplateDir + item);
      } else {
        source  = FileSystem.getFileForPath(boilerplateDir + item);
      }
      q = [
        function() {
          // Create new entry in project tree and let user rename it
          ProjectManager.createNewItem(
            FileSystem.getDirectoryForPath(dest),
            "new_" + item,
            false,
            source.isDirectory
          ).done(q.shift());
        }, function(entry) {
          // remember destination
          dest = entry;
          // Extract the basename for destination
          name = dest.fullPath;
          name = name.substr(name.lastIndexOf("/", name.length-2)+1);
          name = name.replace("/", "");
          if (name.indexOf(".") < 0 && item.indexOf(".") > -1) {
            // Make sure destination has the proper suffix
            suffix = item.substr(item.indexOf("."));
            dest.rename(dest.fullPath + suffix, q.shift());
          } else if (name.indexOf(".") > -1) {
            // Extract new suffix
            suffix  = name.substr(name.indexOf("."));
            name    = name.substr(0, name.indexOf("."));
            q.shift()();
          } else {
            // No suffix
            suffix = "";
            q.shift()();
          }
        }, function (err) {
          // give editor time to open the file
          setTimeout(q.shift(), 1000);
        }, function(err, data) {
          // Copy boilerplate to destination
          copy(source, dest, name, q.shift());
        }, function (err, stat) {
          ProjectManager.refreshFileTree();
        }
      ];
      q.shift()();
    }
  }

  function copy(source, dest, name, cb) {
    cb = cb || function(){};
    if (source.isDirectory && dest.isDirectory) {
      return copyFolder(source, dest, name, cb);
    } else
    if (source.isFile && dest.isFile) {
      return copyFile(source, dest, name, cb);
    } else {
      cb(true);
    }
  }

  function copyFolder(source, dest, name, cb) {
    cb = cb || function(){};
    dest.create(function(err) {
      source.getContents(function(err, entries) {
        var i, basename,
            entriesLeft = entries.length,
            _cb = function(err, stat) {
              entriesLeft--;
              if (entriesLeft <= 0) {
                cb();
              }
            };
        if (entriesLeft <= 0) {
          cb();
        }
        for(i=0;i<entries.length;i++) {
          basename = entries[i].fullPath;
          basename = basename.substr(basename.lastIndexOf("/", basename.length-2)+1);
          if (entries[i].isDirectory) {
            copyFolder(entries[i], FileSystem.getDirectoryForPath(dest.fullPath + basename), name, _cb);
          } else {
            copyFile(entries[i], FileSystem.getFileForPath(dest.fullPath + basename), name, _cb);
          }
        }
      });
    });
  }

  function copyFile(source, dest, name, cb) {
    source.read({}, function(err, data) {
      if (data.indexOf("<<<NAME>>>") > -1) {
        // substitute <<<NAME>>> with `name`
        data = data.replace(/<<<NAME>>>/g, name);
        // Write boilerplate to destination
        dest.write(data, {}, cb);
      } else {
        // Copy boilerplate file to destination
        brackets.fs.copyFile(source.fullPath, dest.fullPath, cb);
      }
    });
  }

  init();
});
