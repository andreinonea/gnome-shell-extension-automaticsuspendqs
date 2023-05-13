'use strict'

const {Gio, GObject} = imports.gi;
const QuickSettings = imports.ui.quickSettings;

// This is the live instance of the Quick Settings menu
const QuickSettingsMenu = imports.ui.main.panel.statusArea.quickSettings;


const AutomaticSuspendToggle = GObject.registerClass(
class AutomaticSuspendToggle extends QuickSettings.QuickToggle {
    _init() {
        super._init({
            // title: 'Auto Suspend',
            toggleMode: true,
        });
        
        // NOTE: In GNOME 44, the `label` property must be set after
        // construction. The newer `title` property can be set at construction.
        this.label = _('Auto Suspend');

        // Binding the toggle to a GSettings key
        this._settings = new Gio.Settings({
            schema_id: 'org.gnome.settings-daemon.plugins.power',
        });

        this._changedId = this._settings.connect('changed::sleep-inactive-battery-type',
            () => this._sync()
        );

        this.connectObject(
            'destroy', () => this._settings.run_dispose(),
            'clicked', () => this._toggleMode(),
            this
        );

        this._sync();
    }

    _toggleMode() {
        this._settings.set_string('sleep-inactive-battery-type',
            this.checked ? 'suspend' : 'nothing');
    }

    _sync() {
        const sleepType = this._settings.get_string('sleep-inactive-battery-type');
        const checked = sleepType === 'suspend';
        if (this.checked !== checked)
            this.set({checked});
    }
});


const AutomaticSuspendIndicator = GObject.registerClass(
class AutomaticSuspendIndicator extends QuickSettings.SystemIndicator {
    _init() {
        super._init();

        // Create the toggle and associate it with the indicator, being sure to
        // destroy it along with the indicator
        this.quickSettingsItems.push(new AutomaticSuspendToggle());
        
        this.connect('destroy', () => {
            this.quickSettingsItems.forEach(item => item.destroy());
        });
        
        // Add the toggle to the menu
        QuickSettingsMenu._addItems(this.quickSettingsItems);
    }
});



const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();


class Extension {
    constructor() {
        log(`initializing ${Me.metadata.name}`);
        this._indicator = null;
    }
    
    enable() {
        log(`enabling ${Me.metadata.name}`);
        this._indicator = new AutomaticSuspendIndicator();
    }
    
    disable() {
        log(`disabling ${Me.metadata.name}`);
        this._indicator.destroy();
        this._indicator = null;
    }
}

function init() {
    return new Extension();
}
