/*
 * Script Name: Barbarian Village Former
 * Version: v1.2
 * Last Updated: 2026-04-17
 * Author Contact: secundum, SaveBank, patched by treforce
 */

// User Input
if (typeof DEBUG !== 'boolean') DEBUG = false;

// Script Config
var scriptConfig = {
    scriptData: {
        prefix: 'barbFormer',
        name: 'Barbarian Village Former',
        version: 'v1.2',
        author: 'secundum, SaveBank',
        authorUrl: '',
        helpLink: 'https://forum.tribalwars.net/index.php?threads/barb-former.291645/',
    },
    translations: {
        en_DK: {
            'Barbarian Village Former': 'Barbarian Village Former',
            Help: 'Help',
            'Redirecting...': 'Redirecting...',
            'There was an error!': 'There was an error!',
            'There was an error while fetching the report data!': 'There was an error while fetching the report data!',
            'Min. Level': 'Min. Level',
            Building: 'Building',
            Group: 'Group',
            'Calculate Commands': 'Calculate Commands',
            'Export as WB format': 'Export as WB format',
            'Max. Distance': 'Max. Distance',
            'Max lvl reduction per command': 'reduce Level/command',
            'Spy Count': 'Spy Count',
            'No matching barbarian reports were found.': 'No matching barbarian reports were found.',
        },
        de_DE: {
            'Barbarian Village Former': 'Barbarendorf Teraformer',
            Help: 'Hilfe',
            'Redirecting...': 'Umleiten...',
            'There was an error!': 'Es gab einen Fehler!',
            'There was an error while fetching the report data!': 'Es gab einen Fehler beim Laden der Berichte!',
            'Min. Level': 'Min. Level',
            Building: 'Gebaeude',
            Group: 'Gruppe',
            'Calculate Commands': 'Berechne Befehle',
            'Export as WB format': 'Kopiere Workbench Befehle',
            'Max. Distance': 'Maximale Distanz',
            'Max lvl reduction per command': 'Level kattern/Befehl',
            'Spy Count': 'Spy Anzahl',
            'No matching barbarian reports were found.': 'Keine passenden Barbarendorf-Berichte gefunden.',
        },
        pt_BR: {
            'Barbarian Village Former': 'Antiga Aldeia Bárbara',
            Help: 'Ajuda',
            'Redirecting...': 'Redirecionando...',
            'There was an error!': 'Houve um erro!',
            'There was an error while fetching the report data!': 'Houve um erro ao buscar os dados do relatório!',
            'Min. Level': 'Nível Mínimo',
            Building: 'Edifício',
            Group: 'Grupo',
            'Calculate Commands': 'Calcular Comandos',
            'Export as WB format': 'Exportar em formato WB',
            'Max. Distance': 'Distância Máxima',
            'Max lvl reduction per command': 'Redução máxima de nível por comando',
            'Spy Count': 'Contagem de Espiões',
            'No matching barbarian reports were found.': 'Nenhum relatório bárbaro compatível foi encontrado.',
        },
    },
    allowedMarkets: [],
    allowedScreens: ['report'],
    allowedModes: ['attack'],
    isDebug: DEBUG,
    enableCountApi: false,
};

$.getScript(`https://twscripts.dev/scripts/twSDK.js?url=${document.currentScript.src}`, async function () {
    await twSDK.init(scriptConfig);

    const scriptInfo = twSDK.scriptInfo();
    const isValidScreen = twSDK.checkValidLocation('screen');
    const isValidMode = twSDK.checkValidLocation('mode');

    let troopData = [];
    const unitInfo = await twSDK.getWorldUnitInfo();
    const catRamSpeed = parseInt(unitInfo.config.ram.speed, 10);

    function arrivalByDistance(distance, offsetSec) {
        const currentServerTime = twSDK.getServerDateTimeObject();
        const totalMilSeconds = distance * catRamSpeed * 60 * 1000 + offsetSec * 1000;
        return currentServerTime.getTime() + totalMilSeconds;
    }

    function getNumericStorageValue(key, fallback) {
        const storedValue = localStorage.getItem(key);
        return storedValue ?? String(fallback);
    }

    function normalizePositiveInteger(value, fallback) {
        const sanitized = String(value ?? '').replace(/\D/g, '');
        const parsed = parseInt(sanitized, 10);
        return Number.isNaN(parsed) || parsed < 1 ? fallback : parsed;
    }

    function normalizeMinLevel(value, fallback) {
        const sanitized = String(value ?? '').replace(/\D/g, '');
        const parsed = parseInt(sanitized, 10);
        if (Number.isNaN(parsed)) return fallback;
        if (parsed < 0) return 0;
        if (parsed > 29) return 29;
        return parsed;
    }

    async function fetchVillageGroups() {
        let fetchGroups = '';

        if (game_data.player.sitter > 0) {
            fetchGroups = game_data.link_base_pure + `groups&mode=overview&ajax=load_group_menu&t=${game_data.player.id}`;
        } else {
            fetchGroups = game_data.link_base_pure + 'groups&mode=overview&ajax=load_group_menu';
        }

        const villageGroups = await jQuery
            .get(fetchGroups)
            .then((response) => response)
            .catch((error) => {
                UI.ErrorMessage('Error fetching village groups!');
                console.error(`${scriptInfo} Error:`, error);
            });

        return villageGroups;
    }

    (async function () {
        try {
            if (isValidScreen && isValidMode) {
                const groups = await fetchVillageGroups();
                renderUI(groups);
                addFilterHandlers();
            } else {
                UI.InfoMessage(twSDK.tt('Redirecting...'));
                twSDK.redirectTo('report&mode=attack');
            }
        } catch (error) {
            UI.ErrorMessage(twSDK.tt('There was an error!'));
            console.error(`${scriptInfo} Error:`, error);
        }
    })();

    function addFilterHandlers() {
        jQuery('#raGroupsFilter').on('change', async function (e) {
            e.preventDefault();

            if (DEBUG) {
                console.debug(`${scriptInfo} selected group ID:`, e.target.value);
            }

            localStorage.setItem(`${scriptConfig.scriptData.prefix}_chosen_group`, e.target.value);
            troopData = await fetchTroopsForCurrentGroup(parseInt(e.target.value, 10));
        });

        const groupOnLoad = parseInt(localStorage.getItem(`${scriptConfig.scriptData.prefix}_chosen_group`) ?? '0', 10);
        fetchTroopsForCurrentGroup(groupOnLoad).then(function (result) {
            troopData = result || [];
        });

        localStorage.setItem(
            `${scriptConfig.scriptData.prefix}_spy`,
            getNumericStorageValue(`${scriptConfig.scriptData.prefix}_spy`, 1)
        );
        jQuery('#raSpy').val(localStorage.getItem(`${scriptConfig.scriptData.prefix}_spy`) ?? '1');
        jQuery('#raSpy').on('change', function (e) {
            e.preventDefault();
            const value = normalizePositiveInteger(e.target.value, 1);
            e.target.value = String(value);
            jQuery('#raSpy').val(String(value));

            if (DEBUG) {
                console.debug(`${scriptInfo} Spy count:`, value);
            }

            localStorage.setItem(`${scriptConfig.scriptData.prefix}_spy`, String(value));
        });

        localStorage.setItem(
            `${scriptConfig.scriptData.prefix}_max_distance`,
            getNumericStorageValue(`${scriptConfig.scriptData.prefix}_max_distance`, 10)
        );
        jQuery('#raMaxDistance').val(localStorage.getItem(`${scriptConfig.scriptData.prefix}_max_distance`) ?? '10');
        jQuery('#raMaxDistance').on('change', function (e) {
            e.preventDefault();
            const value = normalizePositiveInteger(e.target.value, 1);
            e.target.value = String(value);
            jQuery('#raMaxDistance').val(String(value));

            if (DEBUG) {
                console.debug(`${scriptInfo} Max Distance:`, value);
            }

            localStorage.setItem(`${scriptConfig.scriptData.prefix}_max_distance`, String(value));
        });

        localStorage.setItem(
            `${scriptConfig.scriptData.prefix}_max_step`,
            getNumericStorageValue(`${scriptConfig.scriptData.prefix}_max_step`, 2)
        );
        jQuery('#raMaxStep').val(localStorage.getItem(`${scriptConfig.scriptData.prefix}_max_step`) ?? '2');
        jQuery('#raMaxStep').on('change', function (e) {
            e.preventDefault();
            const value = normalizePositiveInteger(e.target.value, 1);
            e.target.value = String(value);
            jQuery('#raMaxStep').val(String(value));

            if (DEBUG) {
                console.debug(`${scriptInfo} Max Step:`, value);
            }

            localStorage.setItem(`${scriptConfig.scriptData.prefix}_max_step`, String(value));
        });

        localStorage.setItem(
            `${scriptConfig.scriptData.prefix}_min_level`,
            getNumericStorageValue(`${scriptConfig.scriptData.prefix}_min_level`, 0)
        );
        jQuery('#raMinAmount').val(localStorage.getItem(`${scriptConfig.scriptData.prefix}_min_level`) ?? '0');
        jQuery('#raMinAmount').on('change', function (e) {
            e.preventDefault();
            const value = normalizeMinLevel(e.target.value, 0);
            e.target.value = String(value);
            jQuery('#raMinAmount').val(String(value));

            if (DEBUG) {
                console.debug(`${scriptInfo} min building level:`, value);
            }

            localStorage.setItem(`${scriptConfig.scriptData.prefix}_min_level`, String(value));
        });

        localStorage.setItem(
            `${scriptConfig.scriptData.prefix}_chosen_building`,
            localStorage.getItem(`${scriptConfig.scriptData.prefix}_chosen_building`) ?? 'smith'
        );

        jQuery('#raBuildingFilter').val(
            localStorage.getItem(`${scriptConfig.scriptData.prefix}_chosen_building`) ?? 'smith'
        );

        jQuery('#raBuildingFilter').on('change', function (e) {
            e.preventDefault();

            if (DEBUG) {
                console.debug(`${scriptInfo} selected building:`, e.target.value);
            }

            localStorage.setItem(`${scriptConfig.scriptData.prefix}_chosen_building`, e.target.value);
        });

        jQuery('#calculateLaunchTimes').on('click', function (e) {
            e.preventDefault();
            getReports();
        });

        jQuery('#exportBBCodeBtn').on('click', function (e) {
            e.preventDefault();
            twSDK.copyToClipboard(jQuery('#barbCoordsList').val());
        });
    }

    function renderGroupsFilter(groups) {
        const groupId = localStorage.getItem(`${scriptConfig.scriptData.prefix}_chosen_group`) ?? '0';
        let groupsFilter = `<select name="ra_groups_filter" id="raGroupsFilter">`;

        for (const [, group] of Object.entries(groups.result)) {
            const { group_id, name } = group;
            const isSelected = parseInt(group_id, 10) === parseInt(groupId, 10) ? 'selected' : '';

            if (typeof name !== 'undefined') {
                groupsFilter += `
                    <option value="${group_id}" ${isSelected}>
                        ${name}
                    </option>
                `;
            }
        }

        groupsFilter += `</select>`;
        return groupsFilter;
    }

    function renderBuildingFilter() {
        const building = localStorage.getItem(`${scriptConfig.scriptData.prefix}_chosen_building`) ?? 'smith';
        let buildingFilter = `<select name="ra_building_filter" id="raBuildingFilter">`;

        for (const key in twSDK.buildings) {
            const isSelected = key === building ? 'selected' : '';
            buildingFilter += `
                <option value="${key}" ${isSelected} style="background-image:url(https://dsde.innogamescdn.com/asset/352e2f8b/graphic/buildings/${key}.png);">
                    ${key}
                </option>
            `;
        }

        buildingFilter += `</select>`;
        return buildingFilter;
    }

    function renderUI(groups) {
        const groupsFilter = renderGroupsFilter(groups);
        const buildingFilter = renderBuildingFilter();

        const content = `
            <div class="ra-single-village-snipe" id="raSingleVillageSnipe">
                <h2>${twSDK.tt(scriptConfig.scriptData.name)}</h2>
                <div class="ra-single-village-snipe-data">
                    <div class="ra-mb15">
                        <div class="ra-grid">
                            <div>
                                <label>${twSDK.tt('Max. Distance')}</label>
                                <input id="raMaxDistance" type="text" value="30">
                            </div>
                            <div>
                                <label>${twSDK.tt('Spy Count')}</label>
                                <input id="raSpy" type="text" value="1">
                            </div>
                            <div>
                                <label>${twSDK.tt('Max lvl reduction per command')}</label>
                                <input id="raMaxStep" type="text" value="1">
                            </div>
                            <div>
                                <label>${twSDK.tt('Min. Level')}</label>
                                <input id="raMinAmount" type="text" value="1">
                            </div>
                            <div>
                                <label>${twSDK.tt('Building')}</label>
                                ${buildingFilter}
                            </div>
                            <div>
                                <label>${twSDK.tt('Group')}</label>
                                ${groupsFilter}
                            </div>
                        </div>
                    </div>
                    <div class="ra-mb15">
                        <a href="javascript:void(0);" id="calculateLaunchTimes" class="btn btn-confirm-yes">
                            ${twSDK.tt('Calculate Commands')}
                        </a>
                        <a href="javascript:void(0);" id="exportBBCodeBtn" class="btn" data-snipe="">
                            ${twSDK.tt('Export as WB format')}
                        </a>
                    </div>
                    <div class="ra-mb15">
                        <textarea id="barbCoordsList" style="width: 100%" class="ra-textarea" readonly=""></textarea>
                    </div>
                </div>
                <small>
                    <strong>${twSDK.tt(scriptConfig.scriptData.name)} ${scriptConfig.scriptData.version}</strong> -
                    <a href="${scriptConfig.scriptData.authorUrl}" target="_blank" rel="noreferrer noopener">
                        ${scriptConfig.scriptData.author}
                    </a> -
                    <a href="${scriptConfig.scriptData.helpLink}" target="_blank" rel="noreferrer noopener">
                        ${twSDK.tt('Help')}
                    </a>
                </small>
            </div>
            <style>
                .ra-single-village-snipe { position: relative; display: block; width: auto; height: auto; clear: both; margin: 0 auto 15px; padding: 10px; border: 1px solid #603000; box-sizing: border-box; background: #f4e4bc; }
                .ra-single-village-snipe * { box-sizing: border-box; }
                .ra-single-village-snipe input[type="text"] { width: 100%; padding: 5px 10px; border: 1px solid #000; font-size: 16px; line-height: 1; }
                .ra-single-village-snipe label { font-weight: 600 !important; margin-bottom: 5px; display: block; }
                .ra-single-village-snipe select { width: 100%; padding: 5px 10px; border: 1px solid #000; font-size: 16px; line-height: 1; }
                .ra-single-village-snipe .btn-confirm-yes { padding: 3px; }

                ${
                    mobiledevice
                        ? '.ra-single-village-snipe { margin: 5px; border-radius: 10px; } .ra-single-village-snipe h2 { margin: 0 0 10px 0; font-size: 18px; } .ra-single-village-snipe .ra-grid { grid-template-columns: 1fr } .ra-single-village-snipe .ra-grid > div { margin-bottom: 15px; } .ra-single-village-snipe .btn { margin-bottom: 8px; margin-right: 8px; } .ra-single-village-snipe select { height: auto; } .ra-single-village-snipe input[type="text"] { height: auto; } .ra-hide-on-mobile { display: none; }'
                        : '.ra-single-village-snipe .ra-grid { display: grid; grid-template-columns: 150px 1fr 100px 150px 150px; grid-gap: 0 20px; }'
                }

                .ra-table { border-collapse: separate !important; border-spacing: 2px !important; }
                .ra-table label,
                .ra-table input { cursor: pointer; margin: 0; }
                .ra-table th { font-size: 14px; }
                .ra-table th,
                .ra-table td { padding: 4px; text-align: center; }
                .ra-table td a { word-break: break-all; }
                .ra-table tr:nth-of-type(2n+1) td { background-color: #fff5da; }
                .ra-table a:focus:not(a.btn) { color: blue; }
                .ra-popup-content { position: relative; display: block; width: 360px; }
                .ra-popup-content * { box-sizing: border-box; }
                .ra-popup-content label { font-weight: 600 !important; margin-bottom: 5px; display: block; }
                .ra-popup-content textarea { width: 100%; height: 100px; resize: none; }
                .ra-mb15 { margin-bottom: 15px; }
                .ra-mb30 { margin-bottom: 30px; }
                .ra-chosen-command td { background-color: #ffe563 !important; }
                .ra-text-left { text-align: left !important; }
                .ra-text-center { text-align: center !important; }
                .ra-unit-count { display: inline-block; margin-top: 3px; vertical-align: top; }
            </style>
        `;

        if (jQuery('.ra-single-village-snipe').length < 1) {
            if (mobiledevice) {
                jQuery('#mobileContent').prepend(content);
            } else {
                jQuery('#contentContainer').prepend(content);
            }
        } else {
            jQuery('.ra-single-village-snipe').replaceWith(content);
        }
    }

    function isBarbarianReport(htmlDoc) {
        const defenderVillageAnchor = jQuery(htmlDoc).find('#attack_info_def .village_anchor').first();
        const defenderPlayerLink = jQuery(htmlDoc).find('#attack_info_def tr:eq(0) th:eq(1) a').first();
        const pageTitle = jQuery(htmlDoc).find('title').text();
        const reportHeadline = jQuery(htmlDoc).find('.report-title .quickedit-label').first().text();

        if (defenderVillageAnchor.length && String(defenderVillageAnchor.attr('data-player')) === '0') {
            return true;
        }

        if (!defenderPlayerLink.length) {
            return true;
        }

        if (/barbarendorf/i.test(pageTitle) || /barbarendorf/i.test(reportHeadline)) {
            return true;
        }

        return false;
    }

    function extractReportInfo(htmlDoc, buildingType) {
        const buildingDataEl = jQuery(htmlDoc).find('#attack_spy_building_data').first();
        if (!buildingDataEl.length) return null;

        let report;
        try {
            report = JSON.parse(buildingDataEl.val());
        } catch (error) {
            if (DEBUG) {
                console.debug(`${scriptInfo} failed parsing report spy data:`, error);
            }
            return null;
        }

        if (!Array.isArray(report) || !report.length) return null;

        const spyResults = {};
        for (let i = 0; i < report.length; i++) {
            spyResults[report[i].id] = report[i];
        }

        if (typeof spyResults[buildingType] === 'undefined') return null;

        if (!isBarbarianReport(htmlDoc)) return null;

        const villageAnchor = jQuery(htmlDoc).find('#attack_info_def .village_anchor').first();
        if (!villageAnchor.length) return null;

        const villageId = parseInt(villageAnchor.attr('data-id'), 10);
        const coord = twSDK.getCoordFromString(villageAnchor.text());
        const buildingLevel = parseInt(spyResults[buildingType].level, 10);
        const wallLevel = parseInt(spyResults.wall?.level ?? 0, 10);

        if (Number.isNaN(villageId) || !coord || Number.isNaN(buildingLevel) || Number.isNaN(wallLevel)) {
            return null;
        }

        return {
            wall: wallLevel,
            building: buildingLevel,
            villageId: villageId,
            coord: coord,
            lastCommand: new Date(),
        };
    }

    function getReports() {
        const buildingType = localStorage.getItem(`${scriptConfig.scriptData.prefix}_chosen_building`);
        const reportData = [];
        const reportUrls = getReportUrls();

        twSDK.startProgressBar(reportUrls.length);

        twSDK.getAll(
            reportUrls,
            function (index, data) {
                twSDK.updateProgressBar(index, reportUrls.length);

                const parser = new DOMParser();
                const htmlDoc = parser.parseFromString(data, 'text/html');

                try {
                    const reportInfo = extractReportInfo(htmlDoc, buildingType);

                    if (reportInfo) {
                        reportData.push(reportInfo);
                    } else if (DEBUG) {
                        console.debug(`${scriptInfo} skipped report at index ${index}`);
                    }
                } catch (e) {
                    console.log('Skipping unusable report:', e);
                }
            },
            function () {
                const commands = doCalculations(reportData);
                let wbCommands = '';

                commands.forEach(function (command, i) {
                    wbCommands += convertWbCommand(command, i);
                });

                if (commands.length === 0) {
                    UI.InfoMessage(twSDK.tt('No matching barbarian reports were found.'));
                }

                jQuery('#barbCoordsList').val(wbCommands);
            },
            function (error) {
                UI.ErrorMessage(twSDK.tt('There was an error while fetching the report data!'));
                console.error(`${scriptInfo} Error:`, error);
            }
        );
    }

    function axesReq(wallLevel) {
        return 30 * wallLevel + 10;
    }

    function calculateAllCombinations(playerVillages, barbarianVillages, minLevel, maxDistance) {
        const combinations = [];

        for (const playerVillage of playerVillages) {
            for (const barbarianVillage of barbarianVillages) {
                const distance = twSDK.calculateDistance(playerVillage.coord, barbarianVillage.coord);
                const wallPossible =
                    barbarianVillage.wall > 0 &&
                    playerVillage.ram >= ramsMin[barbarianVillage.wall] &&
                    playerVillage.axe >= axesReq(barbarianVillage.wall);
                const catPossible =
                    barbarianVillage.building > minLevel &&
                    playerVillage.catapult >= catsMin[barbarianVillage.building];

                if (distance <= maxDistance && (wallPossible || catPossible)) {
                    combinations.push({
                        playerVillage,
                        barbarianVillage,
                        distance,
                    });
                }
            }
        }

        combinations.sort((a, b) => a.distance - b.distance);
        return combinations;
    }

    const ramsRequired = [0, 2, 4, 7, 10, 14, 19, 24, 30, 38, 46, 55, 65, 77, 91, 106, 124, 144, 166, 191, 220];
    const ramsMin = [0, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 6, 6];
    const catsRequiredToBreak = [
        [0, 2, 6, 10, 15, 21, 28, 36, 45, 56, 68, 82, 98, 115, 136, 159, 185, 215, 248, 286, 328, 376, 430, 490, 558, 634, 720, 815, 922, 1041, 1175],
        [0, 0, 2, 6, 11, 17, 23, 31, 39, 49, 61, 74, 89, 106, 126, 148, 173, 202, 234, 270, 312, 358, 410, 469, 534, 508, 691, 784, 888, 1005, 1135],
        [0, 0, 0, 2, 7, 12, 18, 25, 33, 43, 54, 66, 81, 97, 116, 137, 161, 189, 220, 255, 295, 340, 390, 447, 511, 583, 663, 754, 855, 968, 1095],
        [0, 0, 0, 0, 3, 7, 13, 20, 27, 36, 47, 59, 72, 88, 106, 126, 149, 176, 206, 240, 278, 321, 370, 425, 487, 557, 635, 723, 821, 932, 1055],
        [0, 0, 0, 0, 0, 3, 8, 14, 21, 30, 40, 51, 64, 79, 96, 115, 137, 163, 192, 224, 261, 303, 350, 403, 463, 531, 607, 692, 788, 895, 1015],
        [0, 0, 0, 0, 0, 0, 3, 9, 15, 23, 32, 43, 55, 69, 86, 104, 126, 150, 177, 209, 244, 285, 330, 382, 440, 505, 579, 661, 754, 859, 976],
        [0, 0, 0, 0, 0, 0, 0, 3, 9, 17, 25, 35, 47, 60, 76, 93, 114, 137, 163, 193, 227, 266, 310, 360, 416, 479, 550, 631, 721, 822, 936],
        [0, 0, 0, 0, 0, 0, 0, 0, 3, 10, 18, 28, 38, 51, 66, 82, 102, 124, 149, 178, 211, 248, 290, 338, 392, 453, 522, 600, 687, 786, 896],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 11, 20, 30, 42, 56, 72, 90, 111, 135, 162, 194, 230, 270, 316, 368, 427, 494, 569, 654, 749, 856],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 12, 22, 33, 46, 61, 78, 98, 121, 147, 177, 211, 250, 294, 345, 401, 466, 538, 620, 713, 816],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 13, 23, 36, 50, 66, 85, 107, 132, 160, 193, 230, 273, 321, 376, 438, 508, 587, 676, 777],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 14, 26, 39, 54, 72, 92, 116, 143, 175, 210, 251, 297, 350, 409, 477, 553, 640, 737],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 16, 28, 42, 59, 78, 101, 127, 156, 190, 229, 273, 324, 381, 446, 520, 603, 697],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 17, 30, 46, 64, 85, 110, 138, 170, 207, 250, 298, 353, 415, 486, 567, 657],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 18, 33, 50, 70, 93, 120, 150, 186, 226, 272, 325, 385, 453, 530, 617],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 20, 36, 54, 76, 101, 130, 164, 202, 246, 297, 354, 419, 493, 578],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 22, 39, 59, 83, 110, 142, 178, 220, 268, 323, 386, 457, 538],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 24, 43, 65, 90, 120, 155, 195, 240, 292, 352, 420, 498],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 26, 46, 70, 98, 131, 169, 212, 262, 319, 384, 458],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 9, 28, 50, 77, 107, 143, 184, 231, 285, 347, 418],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 30, 55, 84, 117, 156, 200, 252, 311, 379],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 33, 60, 91, 127, 170, 218, 274, 339],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 11, 36, 65, 99, 139, 185, 238, 299],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 39, 71, 108, 151, 201, 259],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 13, 43, 77, 118, 165, 219],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 15, 47, 84, 128, 180],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 16, 51, 92, 140],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 17, 55, 100],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 19, 60],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 20],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];
    const catsMin = [0, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 5, 5, 6, 6, 6, 7, 8, 8, 9, 10, 10, 11, 12, 13, 15, 16, 17, 19, 20];

    function requiredCatas(maxCata, currentLevel, minLevel, maxStep) {
        if (currentLevel <= minLevel || catsMin[currentLevel] > maxCata) {
            return 0;
        }

        let maxDestroyed = currentLevel - minLevel < maxStep ? currentLevel - minLevel : maxStep;

        for (let i = maxDestroyed; i > 0; i--) {
            const catasRequired = catsRequiredToBreak[currentLevel - i][currentLevel];
            if (maxCata >= catasRequired) {
                return i;
            }
        }

        return 0;
    }

    function findTroopCombination(playerVillage, barbarianVillage, distance, minLevel, maxStep, spyAmount) {
        let combinations = [];
        let maxReduction = 0;
        let catapultsRequired = 0;

        const ramsReq = ramsRequired[barbarianVillage.wall];
        const axesRequired = Math.ceil(axesReq(barbarianVillage.wall));

        if (
            (barbarianVillage.wall > 0 && (playerVillage.ram < ramsReq || playerVillage.axe < axesRequired)) ||
            playerVillage.spy < spyAmount
        ) {
            return combinations;
        }

        if (barbarianVillage.wall > 0) {
            playerVillage.axe -= axesRequired;
            playerVillage.ram -= ramsReq;
            barbarianVillage.wall = 0;
            playerVillage.spy -= spyAmount;
            barbarianVillage.dLastAttack = distance;

            combinations.push({
                barbarianVillage,
                playerVillage,
                axe: axesRequired,
                spy: spyAmount,
                ram: ramsReq,
                catapult: 0,
                distance: distance,
            });
        }

        while (barbarianVillage.building > minLevel && playerVillage.spy >= spyAmount) {
            maxReduction = requiredCatas(playerVillage.catapult, barbarianVillage.building, minLevel, maxStep);
            catapultsRequired = catsRequiredToBreak[barbarianVillage.building - maxReduction][barbarianVillage.building];

            if (maxReduction === 0) {
                break;
            }

            playerVillage.catapult -= catapultsRequired;
            barbarianVillage.building -= maxReduction;
            playerVillage.spy -= spyAmount;
            barbarianVillage.dLastAttack = distance;

            combinations.push({
                barbarianVillage,
                playerVillage,
                axe: 0,
                spy: spyAmount,
                ram: 0,
                catapult: catapultsRequired,
                distance: distance,
            });
        }

        return combinations;
    }

    function findTroopCombinations(playerVillages, barbarianVillages, minLevel, maxDistance, maxStep, spyAmount) {
        let result = [];
        const allCombinations = calculateAllCombinations(playerVillages, barbarianVillages, minLevel, maxDistance);

        for (const combination of allCombinations) {
            const { playerVillage, barbarianVillage, distance } = combination;
            const troopCombinations = findTroopCombination(
                playerVillage,
                barbarianVillage,
                distance,
                minLevel,
                maxStep,
                spyAmount
            );

            if (troopCombinations.length) {
                result = result.concat(troopCombinations);
            }
        }

        return result;
    }

    function doCalculations(farmingData) {
        console.log('Starting calculating Commands...');

        const maxDistance = parseInt(localStorage.getItem(`${scriptConfig.scriptData.prefix}_max_distance`), 10);
        const minLevel = parseInt(localStorage.getItem(`${scriptConfig.scriptData.prefix}_min_level`), 10);
        const maxStep = parseInt(localStorage.getItem(`${scriptConfig.scriptData.prefix}_max_step`), 10);
        const spyAmount = parseInt(localStorage.getItem(`${scriptConfig.scriptData.prefix}_spy`), 10);

        const troopCombinations = findTroopCombinations(
            troopData,
            farmingData,
            minLevel,
            maxDistance,
            maxStep,
            spyAmount
        );

        console.log(troopCombinations);
        console.log('##Done##');
        return troopCombinations;
    }

    function convertWbCommand(c, i) {
        return `${c.playerVillage.villageId}&${c.barbarianVillage.villageId}&${
            c.ram > 0 ? 'ram' : 'catapult'
        }&${arrivalByDistance(c.distance, i)}&9&false&false&` +
            `spear=/sword=/axe=${btoa(String(c.axe))}/archer=/spy=${btoa(String(c.spy))}/light=/marcher=/heavy=/ram=${btoa(String(c.ram))}/catapult=${btoa(String(c.catapult))}/knight=/snob=/militia=MA==\n`;
    }

    async function fetchTroopsForCurrentGroup(groupId) {
        const mobileCheck = jQuery('#mobileHeader').length > 0;

        const troopsForGroup = await jQuery
            .get(game_data.link_base_pure + `overview_villages&mode=combined&group=${groupId}&page=-1`)
            .then(async (response) => {
                const htmlDoc = jQuery.parseHTML(response);
                const homeTroops = [];

                if (mobileCheck) {
                    let table = jQuery(htmlDoc).find('#combined_table tr.nowrap');

                    for (let i = 0; i < table.length; i++) {
                        let objTroops = {};
                        let coord = table[i].getElementsByClassName('quickedit-label')[0].innerHTML;
                        let villageId = parseInt(
                            table[i].getElementsByClassName('quickedit-vn')[0].getAttribute('data-id'),
                            10
                        );

                        let listTroops = Array.from(table[i].getElementsByTagName('img'))
                            .filter((e) => e.src.includes('unit'))
                            .map((e) => ({
                                name: e.src.split('unit_')[1].replace('@2x.png', '').replace('.webp', '').replace('.png', ''),
                                value: parseInt(e.parentElement.nextElementSibling.innerText, 10),
                            }));

                        listTroops.forEach((item) => {
                            objTroops[item.name] = item.value;
                        });

                        objTroops.coord = twSDK.getCoordFromString(coord);
                        objTroops.villageId = villageId;
                        homeTroops.push(objTroops);
                    }
                } else {
                    const combinedTableRows = jQuery(htmlDoc).find('#combined_table tr.nowrap');
                    const combinedTableHead = jQuery(htmlDoc).find('#combined_table tr:eq(0) th');
                    const combinedTableHeader = [];

                    jQuery(combinedTableHead).each(function () {
                        const thImage = jQuery(this).find('img').attr('src');

                        if (thImage) {
                            let thImageFilename = thImage.split('/').pop();
                            thImageFilename = thImageFilename.replace('.png', '').replace('.webp', '');
                            combinedTableHeader.push(thImageFilename);
                        } else {
                            combinedTableHeader.push(null);
                        }
                    });

                    combinedTableRows.each(function () {
                        let rowTroops = {};

                        combinedTableHeader.forEach((tableHeader, index) => {
                            if (tableHeader && tableHeader.includes('unit_')) {
                                const coord = twSDK.getCoordFromString(
                                    jQuery(this).find('td:eq(1) span.quickedit-label').text()
                                );
                                const villageId = jQuery(this).find('td:eq(1) span.quickedit-vn').attr('data-id');
                                const unitType = tableHeader.replace('unit_', '');

                                rowTroops = {
                                    ...rowTroops,
                                    villageId: parseInt(villageId, 10),
                                    coord: coord,
                                    [unitType]: parseInt(jQuery(this).find(`td:eq(${index})`).text(), 10) || 0,
                                };
                            }
                        });

                        homeTroops.push(rowTroops);
                    });
                }

                return homeTroops;
            })
            .catch((error) => {
                UI.ErrorMessage('An error occured while fetching troop counts!');
                console.error(`${scriptInfo} Error:`, error);
                return [];
            });

        return troopsForGroup;
    }

    function getReportUrls() {
        const reportUrls = [];

        jQuery('#report_list tbody tr').each(function () {
            const reportUrl = jQuery(this).find('.report-link').attr('href');
            if (typeof reportUrl !== 'undefined' && reportUrl !== '') {
                reportUrls.push(reportUrl);
            }
        });

        return reportUrls;
    }
});
