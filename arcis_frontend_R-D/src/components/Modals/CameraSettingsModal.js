import {
    Box,
    Flex,
    Text,
    Tabs,
    TabList,
    Tab,
    Input,
    Button,
    useColorModeValue,
    Divider,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Select,
    Switch,
    Spacer,
    Slider,
    SliderTrack,
    SliderFilledTrack,
    SliderThumb,
    Grid,
    FormControl,
    FormLabel,
    useToast,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import {
    getImageInfo,
    getVideoEncodeChannelMain,
    getVideoEncodeChannelSub,
    getVideoSettings,
    rebootCamera,
    setImageInfo,
    setVideoEncodeChannelMain,
    setVideoEncodeChannelSub,
    setVideoSettings,
} from "../../actions/settingsActions";

const CameraSettingsModal = ({
    isOpen,
    onClose,
    deviceId,
    cameraName,
    productType,
}) => {
    const toast = useToast();

    // -- State Variables Migrated from Cameras.js --
    const [activeTab, setActiveTab] = useState("Video settings");

    // Video Settings Tab (raw encode config)
    const [streamType, setStreamType] = useState("main");
    const [bitRate, setBitRate] = useState("");
    const [frameRate, setFrameRate] = useState("");
    const [codecType, setCodecType] = useState("");
    const [resolution, setResolution] = useState("");
    const [bitRateType, setBitRateType] = useState("");

    // Media Tab
    const [irCutMode, setIrCutMode] = useState(false);
    const [brightness, setBrightness] = useState(50);
    const [contrast, setContrast] = useState(50);
    const [saturation, setSaturation] = useState(0);
    const [hue, setHue] = useState(0);
    const [sharpness, setSharpness] = useState(50);
    const [flip, setFlip] = useState(false);
    const [mirror, setMirror] = useState(false);

    // Wifi Settings (Placeholder from original code)
    // const [wifiName, setWifiName] = useState("");
    // const [wifiPassword, setWifiPassword] = useState("");

    const theme = useColorModeValue("light", "dark"); // Simplified theme access
    const saveButtonBackgroundColor = useColorModeValue("custom.primary", "custom.darkModePrimary");
    const saveButtonColor = useColorModeValue("white", "white");
    const saveButtonHoverBackgroundColor = useColorModeValue("custom.primaryHover", "custom.darkModePrimaryHover");
    const saveButtonHoverColor = useColorModeValue("white", "white");


    // --- Helper Functions ---

    const fetchData = async () => {
        if (!deviceId) return;

        try {
            if (activeTab === "Media") {
                const response = await getVideoSettings(deviceId);
                const response2 = await getImageInfo(deviceId);
                if (response2) setIrCutMode(response2.irCutMode);
                if (response) {
                    setBrightness(response.brightnessLevel);
                    setContrast(response.contrastLevel);
                    setSaturation(response.saturationLevel);
                    setSharpness(response.sharpnessLevel);
                    setHue(response.hueLevel);
                    setMirror(response.mirrorEnabled);
                    setFlip(response.flipEnabled);
                }
            } else if (activeTab === "Video settings") {
                const response = streamType === "main"
                    ? await getVideoEncodeChannelMain(deviceId)
                    : await getVideoEncodeChannelSub(deviceId);
                if (response) {
                    setBitRate(response.constantBitRate || "");
                    setFrameRate(response.frameRate || "");
                    setCodecType(response.codecType || "");
                    setResolution(response.resolution || "");
                    setBitRateType(response.bitRateControlType || "");
                }
            }
        } catch (error) {
            console.error(`Failed to fetch ${activeTab} settings:`, error);
            toast({ title: "Error fetching settings", status: "error", duration: 3000, isClosable: true });
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen, activeTab, deviceId, streamType]);


    // --- Handlers ---

    const handleRebootCamera = async () => {
        try {
            await rebootCamera(deviceId);
            toast({ title: "Camera Rebooting...", status: "info", duration: 3000, isClosable: true });
        } catch (error) {
            console.error("Error rebooting camera:", error);
            toast({ title: "Reboot failed", status: "error", duration: 3000, isClosable: true });
        }
    };

    const handleVideoEncodeSave = async () => {
        try {
            if (streamType === "main") {
                await setVideoEncodeChannelMain(deviceId, codecType, resolution, bitRateType, bitRate, frameRate);
            } else {
                await setVideoEncodeChannelSub(deviceId, codecType, resolution, bitRateType, bitRate, frameRate);
            }
            toast({ title: "Video Settings Saved", status: "success", duration: 3000, isClosable: true });
        } catch (error) {
            console.error("Error saving video settings:", error);
            toast({ title: "Save failed", status: "error", duration: 3000, isClosable: true });
        }
    };

    const handleMediaSettings = async () => {
        try {
            await setVideoSettings(deviceId, brightness, contrast, saturation, hue, sharpness, flip, mirror);
            await setImageInfo(deviceId, irCutMode);
            toast({ title: "Media Settings Saved", status: "success", duration: 3000, isClosable: true });
        } catch (error) {
            console.error("Error saving media settings:", error);
            toast({ title: "Save failed", status: "error", duration: 3000, isClosable: true });
        }
    };


    return (
        <Modal isOpen={isOpen} onClose={onClose} size="3xl">
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>Camera Settings</ModalHeader>
                <ModalBody>
                    <Tabs variant="unstyled" mb={6} onChange={(index) => setActiveTab(["Video settings", "Media", "Wifi Settings"][index])}>
                        <TabList>
                            {["Video settings", "Media"].map((tab) => (
                                <Tab
                                    key={tab}
                                    _selected={{ fontWeight: "bold", borderBottom: "4px solid", borderColor: saveButtonBackgroundColor }}
                                >
                                    {tab}
                                </Tab>
                            ))}
                            {productType === "Wifi-S-Series" && (
                                <Tab _selected={{ fontWeight: "bold", borderBottom: "4px solid", borderColor: saveButtonBackgroundColor }}>
                                    Wifi Settings
                                </Tab>
                            )}
                        </TabList>
                    </Tabs>

                    {/* --- VIDEO SETTINGS TAB --- */}
                    {activeTab === "Video settings" && (
                        <Box>
                            <Flex alignItems="center" justifyContent="space-between" mb={4}>
                                <Text>Device Name</Text>
                                <Input disabled defaultValue={cameraName} size="sm" maxW="60%" />
                            </Flex>

                            <Grid templateColumns={{ base: "1fr", sm: "repeat(2, 1fr)" }} gap={4} mb={4}>
                                <FormControl>
                                    <FormLabel>Stream Type</FormLabel>
                                    <Select value={streamType} onChange={(e) => setStreamType(e.target.value)} size="sm">
                                        <option value="main">Main Stream</option>
                                        <option value="sub">Sub Stream</option>
                                    </Select>
                                </FormControl>
                                <FormControl>
                                    <FormLabel>Bit Rate</FormLabel>
                                    <Input value={bitRate} onChange={(e) => setBitRate(e.target.value)} placeholder="Bit Rate" size="sm" />
                                </FormControl>
                                <FormControl>
                                    <FormLabel>FPS</FormLabel>
                                    <Input value={frameRate} onChange={(e) => setFrameRate(e.target.value)} placeholder="FPS" size="sm" />
                                </FormControl>
                                <FormControl>
                                    <FormLabel>Profile</FormLabel>
                                    <Select value={codecType} onChange={(e) => setCodecType(e.target.value)} placeholder="Codec Type" size="sm">
                                        <option value="H.264">H.264</option>
                                        <option value="H.265">H.265</option>
                                        <option value="H.264+">H.264+</option>
                                        <option value="H.265+">H.265+</option>
                                    </Select>
                                </FormControl>
                                <FormControl>
                                    <FormLabel>Bit Rate Type</FormLabel>
                                    <Select value={bitRateType} onChange={(e) => setBitRateType(e.target.value)} placeholder="Select type" size="sm">
                                        <option>CBR</option>
                                        <option>VBR</option>
                                    </Select>
                                </FormControl>
                                <FormControl>
                                    <FormLabel>Resolution</FormLabel>
                                    <Select value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="Select resolution" size="sm">
                                        {streamType === "main" ? (
                                            <>
                                                <option value="2304x1296">2304x1296</option>
                                                <option value="1920x1080">1920x1080</option>
                                                <option value="1280x720">1280x720</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="800x448">800x448</option>
                                                <option value="640x360">640x360</option>
                                            </>
                                        )}
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Divider mb={2} />
                            <Flex w="full" justifyContent="flex-end">
                                <Button variant="outline" size="sm" mr={2} onClick={onClose}>Close</Button>
                                <Button
                                    size="sm"
                                    background={saveButtonBackgroundColor}
                                    color={saveButtonColor}
                                    _hover={{ backgroundColor: saveButtonHoverBackgroundColor, color: saveButtonHoverColor }}
                                    onClick={handleVideoEncodeSave}
                                >
                                    Save
                                </Button>
                            </Flex>
                        </Box>
                    )}


                    {/* --- MEDIA TAB --- */}
                    {activeTab === "Media" && (
                        <Box>
                            <Flex alignItems="center" justifyContent="space-between" mb={4}>
                                <Text>IR Mode</Text>
                                <Select value={irCutMode} onChange={(e) => setIrCutMode(e.target.value)} size="sm" maxW="60%">
                                    <option value="auto">IrLedMode</option>
                                    <option value="light">Light Mode</option>
                                    <option value="smart">Smart Mode</option>
                                    <option value="daylight">Daylight Mode</option>
                                    <option value="night">Night Mode</option>
                                </Select>
                            </Flex>

                            {/* Reusable Slider Helper */}
                            {[
                                { label: "Brightness", val: brightness, set: setBrightness },
                                { label: "Contrast", val: contrast, set: setContrast },
                                { label: "Saturation", val: saturation, set: setSaturation },
                                { label: "Hue", val: hue, set: setHue },
                                { label: "Sharpness", val: sharpness, set: setSharpness }
                            ].map((item) => (
                                <Flex key={item.label} alignItems="center" justifyContent="space-between" mb={4}>
                                    <Text flex="1">{item.label}</Text>
                                    <Box flex="1" mx={4}>
                                        <Slider value={item.val} onChange={item.set} min={0} max={100} step={1}>
                                            <SliderTrack><SliderFilledTrack /></SliderTrack>
                                            <SliderThumb />
                                        </Slider>
                                    </Box>
                                    <Text>{item.val}%</Text>
                                </Flex>
                            ))}

                            <Flex alignItems="center" justifyContent="space-between" mb={4}>
                                <Text flex="1">Flip</Text>
                                <Switch size="sm" isChecked={flip} onChange={() => setFlip(!flip)} />
                            </Flex>

                            <Flex alignItems="center" justifyContent="space-between" mb={4}>
                                <Text flex="1">Mirror</Text>
                                <Switch size="sm" isChecked={mirror} onChange={() => setMirror(!mirror)} />
                            </Flex>

                            <Divider mb={2} />
                            <Flex w="full" justifyContent="space-between">
                                <Button p={0} colorScheme="red" variant="ghost" textDecoration={"underline"} size="sm" onClick={handleRebootCamera}>Reboot Camera</Button>
                                <Spacer />
                                <Button variant="outline" size="sm" mr={2} onClick={onClose}>Close</Button>
                                <Button
                                    size="sm"
                                    background={saveButtonBackgroundColor}
                                    color={saveButtonColor}
                                    _hover={{ backgroundColor: saveButtonHoverBackgroundColor, color: saveButtonHoverColor }}
                                    onClick={handleMediaSettings}
                                >
                                    Save
                                </Button>
                            </Flex>
                        </Box>
                    )}

                </ModalBody>
                <ModalFooter>
                    {/* Footer content if needed */}
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

export default CameraSettingsModal;
