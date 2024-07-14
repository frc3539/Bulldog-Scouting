import {
	TextInput,
	View,
	Text,
	Alert,
	Image,
	Switch,
	Button,
} from 'react-native';
import React, { useState, useEffect } from 'react';
import { styles } from './Styles'
import { CameraView, useCameraPermissions } from 'expo-camera';
// import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import { qrDataFilePath } from '../App'
import RadioButtonGroup, { RadioButtonItem } from "expo-radio-button";
// import {
// 	Portal,
// 	Dialog,
// 	PaperProvider
// } from 'react-native-paper';

// Keep track of changes so we can update the team number only when we change station, match number,
// or if we load new qr code data, this will allow us to override the teamnumber if we must.
var lastMatch = 0;
var lastStation = '';
var lastMatchData = {};
const clearFilePass = '3539' // Should be a number


function compareObjects(obj1, obj2) {
	const keys1 = Object.keys(obj1);
	const keys2 = Object.keys(obj2);

	// Check if the number of keys is the same
	if (keys1.length !== keys2.length) {
		return false;
	}

	// Check if all keys in obj1 are present in obj2 and have the same values
	for (let key of keys1) {
		if (obj1[key] !== obj2[key]) {
			return false;
		}
	}

	// If all checks passed, the objects are equal
	return true;
}

export function Setup({ updateStates, resetTrigger }) {
	// States that reset between matches
	const [teamNumber, setTeamNumber] = useState('');
	const [noShow, setNoShow] = useState(false);
	const [preloaded, setPreloaded] = useState(false);
	const [startArea, setStartArea] = useState('A');

	// States that do not reset between matches
	const [station, setStation] = useState('red1');
	const [match, setMatch] = useState('1');
	const [matchData, setMatchData] = useState({}); // Not included in main state

	//Camera Stuff (not included in main state)
	const [scanned, setScanned] = useState(false);
	const [scanMode, setScanMode] = useState(false); // Add key state
	const [permission, requestPermission] = useCameraPermissions();
	const [visible, setVisible] = React.useState(false);
	const [password, setPassword] = useState('');
	const showDialog = () => setVisible(true);

	// On change in reset trigger variable from main app, reset state
	useEffect(() => {
		console.log('Setup reset trigger activated');
        updateState('teamNumber', setTeamNumber, '');
        updateState('noShow', setNoShow, false);
        updateState('preloaded', setPreloaded, false);
        updateState('startArea', setStartArea, 'A');
        updateState('station', setStation, 'red1');
        updateState('match', setMatch, '1');
		// TODO: how does reset work for the "Camera stuff" states?
		// only use "updateState" if meant to be included in main state
		// otherwise the normal setter will do
	}, [resetTrigger]);

	// Intermediary state updater function
	// Sends update to main app and updates local state
	const updateState = (stateName, stateUpdateFunction, stateValue) => {
		updateStates({stateName: stateValue});
		stateUpdateFunction(stateValue);
	};

	const hideDialog = () => {
		setVisible(false);
		setPassword('');
	}

	async function handleBarCodeScanned({ type, data }) {
		var copyMatchData = matchData;
		setScanned(true);

		// Create an empty dictionary to store parsed data
		var matches = data.toString().split(';');

		// Iterate through each match
		matches.forEach(match => {
			if (!match.includes(",")) return;

			// Split the match by comma to get individual teams
			const loadedMatchData = match.split(',');

			// Extract team colors
			const matchTeams = {
				red1: loadedMatchData[1],
				red2: loadedMatchData[2],
				red3: loadedMatchData[3],
				blue1: loadedMatchData[4],
				blue2: loadedMatchData[5],
				blue3: loadedMatchData[6]
			};

			copyMatchData[loadedMatchData[0]] = matchTeams
			setMatchData(copyMatchData);
		});

		// Save match data to local storage
		await FileSystem.writeAsStringAsync(qrDataFilePath, JSON.stringify(matchData));

		Alert.alert(
			`Data Added`,
			'Data Added',
			[ { text: 'Continue', onPress: () => setScanned(false) } ]
		);
	}

	async function clearFile() {
		setMatchData({});
		await FileSystem.writeAsStringAsync(qrDataFilePath, matchData);
	}

	async function tryClearFile(password, setPassword, hideDialog) {
		if (password == clearFilePass) {
			Alert.alert(
				`Are you sure?`,
				'Clearing the data will erase all currently stored match data. This will be unrecoverable.',
				[ { text: 'Cancel' }, { text: 'Continue', onPress: clearFile } ]
			);
		}
		else {
			Alert.alert(
				`Error`,
				'Incorrect password.',
				[ { text: 'Return' } ]
			);
		}
		setPassword('')
		hideDialog()
	}

	useEffect(() => {
		if (match != lastMatch || station != lastStation || !compareObjects(matchData, lastMatchData)) {
			updateState('teamNumber', setTeamNumber, matchData?.[match]?.[station] ?? '');
		}
		lastMatch = match
		lastStation = station
		lastMatchData = { ...matchData }
	}, [match, lastMatch, station, lastStation, matchData, lastMatchData]);

	// useFocusEffect(
	// 	useCallback(() => {
	// 		setScanned(false);
	// 		setKey(prevKey => prevKey + 1); // Change key to force remount
	// 		return () => {
	// 			// Cleanup function when the component unmounts
	// 		};
	// 	}, [])
	// );

	if (!permission) {
		// Camera permissions are still loading.
		return <View />;
	}

	if (!permission.granted) {
		// Camera permissions are not granted yet.
		return (
			<View style={styles.vstack}>
				<Text style={{ textAlign: 'center' }}>We need your permission to show the camera</Text>
				<Button title="Grant Permission" onPress={requestPermission} />
			</View>
		);
	}

	if (scanMode) {
		return (
			<View style={styles.cameraContainer}>
				<CameraView
					style={styles.camera}
					barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
					onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
					ratio='16:9'
				/>
				<View style={styles.hstack}>
					<Button title="Return" onPress={() => setScanMode(!scanMode)}/>
					<Button title="Clear Loaded Match Data" onPress={() => showDialog()}/>
				</View>
				{/* <PaperProvider>
				<Portal>
					<Dialog visible={visible} onDismiss={hideDialog}>
						<Dialog.Title>Enter Your Password</Dialog.Title>
						<Dialog.Content>
							<TextInput
								style={styles.SingleLineInput}
								onChangeText={setPassword}
								value={password}
								placeholder="Password"
								keyboardType="numeric"
								secureTextEntry={true}
							/>
						</Dialog.Content>
						<Dialog.Actions>
							<Button title="Cancel" onPress={hideDialog}/>
							<Button title="Continue" onPress={() => tryClearFile(password, setPassword, hideDialog)}/>
						</Dialog.Actions>
					</Dialog>
				</Portal>
				</PaperProvider> */}
			</View>
		);
	}


	return (
		<View style={styles.generalViewStyle}>
			<Text style={{ fontSize: 25 }}>Alliance Station</Text>

			<View style={styles.hstack}>
				<RadioButtonGroup
					selected={station}
					onSelected={
						(nextValue) => updateState('station', setStation, nextValue)
					}
				>
					<RadioButtonItem label="Red 1" value="red1" />
					<RadioButtonItem label="Red 2" value="red2" />
					<RadioButtonItem label="Red 3" value="red3" />
				</RadioButtonGroup>
				<RadioButtonGroup
					selected={station}
					onSelected={
						(nextValue) => updateState('station', setStation, nextValue)
					}
				>
					<RadioButtonItem label="Blue 1" value="blue1" />
					<RadioButtonItem label="Blue 2" value="blue2" />
					<RadioButtonItem label="Blue 3" value="blue3" />
				</RadioButtonGroup>
			</View>

			<View style={styles.hstack}>
				<View style={styles.vstack}>
					<Text style={{ fontSize: 18 }}>Preloaded</Text>
					<Switch onValueChange={() => updateState('preloaded', setPreloaded, !preloaded)} value={preloaded}/>
				</View>
				<View style={styles.vstack}>
					<Text style={{ fontSize: 18 }}>No Show</Text>
					<Switch onValueChange={() => updateState('noShow', setNoShow, !noShow)} value={noShow}/>
				</View>
			</View>

			<View style={styles.hstack}>
				<View style={styles.vstack}>
					<Text>Match Number</Text>
					<TextInput
						style={styles.SingleLineInput}
						onChangeText={text => updateState('match', setMatch, text)}
						value={match}
						placeholder="Match Number"
						keyboardType="number-pad"
						inputMode='numeric'
					/>
				</View>
				<View style={styles.vstack}>
					<Text>Team Number</Text>
					<TextInput
						style={styles.SingleLineInput}
						onChangeText={text => updateState('teamNumber', setTeamNumber, text)}
						value={teamNumber}
						placeholder="Team Number"
						keyboardType="number-pad"
						maxLength={5}
						inputMode='numeric'
					/>
				</View>
			</View>

			<View style={styles.hstackFullWidth}>
				<Image
					style={styles.setupImage}
					source={station.includes('blue')? require('../assets/BlueStartPosition.png')
						: require('../assets/RedStartPosition.png')}
				/>
				<View style={styles.vstack}>
					<RadioButtonGroup
						selected={startArea}
						onSelected={
							(nextValue) => updateState('startArea', setStartArea, nextValue)
						}
					>
						<RadioButtonItem label="A" value="A" />
						<RadioButtonItem label="B" value="B" />
						<RadioButtonItem label="C" value="C" />
						<RadioButtonItem label="D" value="D" />
					</RadioButtonGroup>
				</View>
			</View>
			<Button title="Scan QR" onPress={() => setScanMode(!scanMode)}/>

		</View>
	)
}