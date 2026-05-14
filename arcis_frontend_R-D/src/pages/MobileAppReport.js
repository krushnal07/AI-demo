import React, { useEffect, useState, useCallback, useRef } from "react";
import {
    Box,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalCloseButton,
    useDisclosure,
    Text,
    Badge,
    Spinner,
    Center,
    useToast,
    Heading,
    HStack,
    Flex,
    Select,
    Grid,
    useColorModeValue, Link as ChakraLink,
    Image,
    useColorMode,
    RadioGroup,
    Radio,
    Input,
    GridItem,
    Button,
    SimpleGrid,
    Collapse,
    Divider,
    IconButton,
} from "@chakra-ui/react";
import { GoogleMap, useJsApiLoader, MarkerF } from "@react-google-maps/api";
import axios from "axios";
import Player from "../components/Player";
import moment from "moment";
import { FaChevronUp, FaChevronDown, FaDownload, FaAngleLeft, FaAngleRight, FaAnglesLeft, FaAnglesRight, FaFilePdf } from "react-icons/fa6";
import { Link as RouterLink, useLocation } from "react-router-dom";
import { BsVolumeMute, BsVolumeUp, BsArrowsFullscreen } from "react-icons/bs";

// PDF Imports
import jsPDF from "jspdf";
import "jspdf-autotable";
import vmLogo from "../assets/vmlogo (1).png"; // LOGO IMPORTED HERE

const containerStyle = {
    width: "100%",
    height: "100%",
};

// --- Helper Functions ---
const generateStreamUrl = (camera) => {
    if (camera.plan === "LIVE" && camera.p2purl && camera.token) {
        return `https://${camera.deviceId}.${camera.p2purl}/flv/live_ch0_0.flv?verify=${camera.token}`;
    }
    if (camera.mediaUrl) {
        return `wss://${camera.mediaUrl}/jessica/DVR/${camera.deviceId}.flv`;
    }
    return "";
};

const isCameraOnline = (camera) => {
    if (!camera || !camera.status) return false;
    if (typeof camera.status === 'string' && camera.status.toUpperCase() === 'ONLINE') return true;
    if (camera.status === true || camera.status === 1 || camera.status === "1") return true;
    return false;
};

const getLocationName = (camera) => {
    if (camera.location) return camera.location;
    if (camera.vehicleNo) return camera.vehicleNo;
    if (camera.locations && camera.locations.length > 0) {
        return typeof camera.locations[0] === 'string'
            ? camera.locations[0]
            : (camera.locations[0]?.loc_name || "");
    }
    return camera.loc_name || "";
};

const tableContainerStyle = {
    maxHeight: "calc(180vh - 500px)",
    overflowY: "auto",
    overflowX: "auto",
    border: "1px solid #b3b8d6ff",
    borderRadius: "5px",
};

const tableHeaderRowStyle = {
    position: "sticky",
    top: 0,
    zIndex: 1,
    borderRadius: "5px"
};

const tableHeaderStyle = {
    padding: "8px 10px",
    verticalAlign: "middle",
    textAlign: "center",
    position: "relative",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
};

const tableDataStyle = {
    padding: "8px 10px",
    verticalAlign: "middle",
    textAlign: "center",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    position: "relative",
    borderBottom: "1px solid #6c8aa5ff",
};

const VerticalLine = () => (
    <span
        style={{
            position: "absolute",
            right: "0",
            top: "50%",
            transform: "translateY(-50%)",
            height: "60%",
            width: "2px",
            backgroundColor: "#3F77A5",
        }}
    ></span>
);

const GpsTrackingMap = () => {
    const [allCameras, setAllCameras] = useState([]);
    const [filteredCameras, setFilteredCameras] = useState([]);
    const [displayedCameras, setDisplayedCameras] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedCamera, setSelectedCamera] = useState(null);
    const [streamUrl, setStreamUrl] = useState("");
    const [districtsList, setDistrictsList] = useState([]);
    const [selectedDistrictName, setSelectedDistrictName] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [assembliesList, setAssembliesList] = useState([]);
    const [selectedAssemblyValue, setSelectedAssemblyValue] = useState("");
    const [psOption, setPsOption] = useState("camera");
    const placeholderColor = useColorModeValue("gray.600", "gray.400");
    const [searchDeviceId, setSearchDeviceId] = useState("");
    const textColor = useColorModeValue("black", "white");
    const [itemsPerPage] = useState(50);
    const [locationsList, setLocationsList] = useState([]);
    const [searchLocation, setSearchLocation] = useState("");
    const [isVehicleLoading, setIsVehicleLoading] = useState(false);
    const [expandedRows, setExpandedRows] = useState({});
    const [map, setMap] = useState(null);
    const { isOpen, onOpen, onClose } = useDisclosure();
    const toast = useToast();
    const text = useColorModeValue('gray.500', 'gray.400');
    const headerBg = useColorModeValue("white", "gray.900");
    const buttonGradientColor = useColorModeValue("linear-gradient(93.5deg,#CDDEEB ,  #9CBAD2 94.58%)", "linear-gradient(93.5deg, #2A2A2A 0.56%, #030711 50.58%)");
    const [isMuted, setIsMuted] = useState(true);
    const [isFs, setIsFs] = useState(false);
    const containerRef = useRef(null);

    // Isolated Loading States
    const [isGlobalPdfLoading, setIsGlobalPdfLoading] = useState(false);
    const [rowLoadingUniqueId, setRowLoadingUniqueId] = useState(null);


    useEffect(() => {
        const handleFsChange = () => setIsFs(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", handleFsChange);
        return () => document.removeEventListener("fullscreenchange", handleFsChange);
    }, []);

    const toggleFullscreen = () => {
        if (!isFs) { containerRef.current?.requestFullscreen?.(); }
        else { document.exitFullscreen?.(); }
    };

    const handleCloseModal = () => {
        setSelectedCamera(null);
        setStreamUrl("");
        setIsMuted(true);
        onClose();
    };

    // 1. FETCH DATA FROM HOST_API (Bound to environment variable)
    useEffect(() => {
        const fetchCameras = async () => {
            setLoading(true);
            try {

                const response = await axios.get(process.env.REACT_APP_HOST_API);
                const data = Array.isArray(response.data) ? response.data : (response.data.data || []);
                setAllCameras(data);
            } catch (error) {
                console.error("Error fetching cameras:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchCameras();
    }, []);

    // 2. EXTRACT DISTRICTS
    useEffect(() => {
        const districts = [...new Set(allCameras.map((c) => c.district || c.districtName).filter(Boolean))];
        setDistrictsList(districts.sort());
    }, [allCameras]);

    // 3. UPDATE ASSEMBLIES
    useEffect(() => {
        if (selectedDistrictName) {
            const cams = allCameras.filter((c) => (c.district || c.districtName) === selectedDistrictName);
            const assemblies = [...new Set(cams.map((c) => c.assembly || c.acName).filter(Boolean))];
            setAssembliesList(assemblies.sort());
        } else {
            setAssembliesList([]);
        }
    }, [selectedDistrictName, allCameras]);

    // 4. UPDATE VEHICLES BASED ON ASSEMBLY
    useEffect(() => {
        if (selectedAssemblyValue && selectedDistrictName) {
            const filteredByAssembly = allCameras.filter(
                (c) =>
                    (c.district || c.districtName) === selectedDistrictName &&
                    (c.assembly || c.acName) === selectedAssemblyValue
            );
            const vehicles = [...new Set(filteredByAssembly.map((c) => c.vehicleNo).filter(Boolean))];
            setLocationsList(vehicles.sort());
        } else {
            setLocationsList([]);
        }
    }, [selectedAssemblyValue, selectedDistrictName, allCameras]);

    // 5. MAIN FILTER LOGIC
    useEffect(() => {
        let data = [...allCameras];
        if (selectedDistrictName) data = data.filter((c) => (c.district || c.districtName) === selectedDistrictName);
        if (selectedAssemblyValue) data = data.filter((c) => (c.assembly || c.acName) === selectedAssemblyValue);

        if (searchLocation) {
            data = data.filter((c) => c.vehicleNo === searchLocation);
        }

        if (searchDeviceId) {
            const term = searchDeviceId.toLowerCase();
            if (psOption === "ps") {
                data = data.filter((c) => String(c.location || c.vehicleNo || "").toLowerCase().includes(term));
            } else {
                data = data.filter((c) => String(c.ptzCameraSerialNumber || c.deviceId || "").toLowerCase().includes(term));
            }
        }
        setFilteredCameras(data);
    }, [allCameras, selectedDistrictName, selectedAssemblyValue, searchDeviceId, psOption, searchLocation]);

    // RESET PAGE ON FILTER CHANGE
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedDistrictName, selectedAssemblyValue, searchLocation, searchDeviceId]);

    // 6. PAGINATION SYNC
    useEffect(() => {
        const indexOfLastItem = currentPage * itemsPerPage;
        const indexOfFirstItem = indexOfLastItem - itemsPerPage;
        setDisplayedCameras(filteredCameras.slice(indexOfFirstItem, indexOfLastItem));
    }, [filteredCameras, currentPage, itemsPerPage]);

    const handleDistrictChange = (e) => {
        setSelectedDistrictName(e.target.value);
        setSelectedAssemblyValue("");
        setSearchLocation("");
        setSearchDeviceId("");
    };

    const handleAssemblyChange = (e) => {
        setSelectedAssemblyValue(e.target.value);
        setSearchLocation("");
    };

    const handleSearchDeviceIdChange = (event) => {
        setSearchDeviceId(event.target.value);
    };

    const toggleRow = (index) => {
        setExpandedRows(prev => ({ ...prev, [index]: !prev[index] }));
    };

    const handleDownload = async (url, filename) => {
        if (!url) return;
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename || 'image.jpg';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(blobUrl);
        } catch (error) {
            console.error("Download failed", error);
            window.open(url, '_blank');
        }
    };

    // --- Helper for PDF Image Processing ---
    const getImageDataUrl = (url) => {
        return new Promise((resolve) => {
            if (!url) return resolve(null);
            const img = new window.Image();
            img.setAttribute('crossOrigin', 'anonymous');
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/jpeg'));
            };
            img.onerror = () => resolve(null);
            img.src = url;
        });
    };

    // --- PDF Export Logic ---
    const handlePDFExport = () => {
        setIsGlobalPdfLoading(true);
        const doc = new jsPDF("l", "mm", "a4");

        doc.setFontSize(16);
        doc.text("Mobile App Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated on: ${moment().format("YYYY-MM-DD HH:mm")}`, 14, 22);

        let finalY = 25;

        filteredCameras.forEach((camera, index) => {
            if (finalY > 160) {
                doc.addPage();
                finalY = 20;
            }

            doc.autoTable({
                startY: finalY,
                head: [['SR NO.', 'DISTRICT', 'ASSEMBLY', 'DEVICE ID', 'VEHICLE NO.', 'DRIVER NAME', 'DRIVER CONTACT']],
                body: [[
                    index + 1,
                    camera.district || camera.districtName || "N/A",
                    camera.assembly || camera.acName || "N/A",
                    camera.ptzCameraSerialNumber || "N/A",
                    camera.vehicleNo || "N/A",
                    camera.driverName || "N/A",
                    camera.driverMobileNo || "N/A"
                ]],
                theme: 'grid',
                headStyles: { fillColor: [156, 186, 210], textColor: [0, 0, 0], halign: 'center', fontStyle: 'bold' },
                bodyStyles: { halign: 'center', textColor: [0, 0, 0] },
                margin: { left: 14, right: 14 }
            });

            finalY = doc.lastAutoTable.finalY;

            doc.autoTable({
                startY: finalY,
                body: [
                    [
                        {
                            content: `\nInstall Date: ${camera.installationDate ? moment(camera.installationDate).format('YYYY-MM-DD HH:mm') : "N/A"}
                            \nSite Address: ${camera.installationSiteAddress || "N/A"}
                            \nVehicle Type: ${camera.typeOfVehicle || "N/A"}
                            \nCreated By: ${camera.createdByMobile || "N/A"}
                            \nCreated At: ${camera.createdAt ? moment(camera.createdAt).format('YYYY-MM-DD HH:mm') : "N/A"}`,
                            styles: { halign: 'left' }
                        },
                        {
                            content: `\nPTZ Model: ${camera.ptzCameraModelNumber || "N/A"}
                            \nPTZ Installed: ${camera.ptzCameraInstalledOnVehicle || "N/A"}
                            \nNVR Model: ${camera.nvrModelNo || "N/A"}
                            \nNVR Installed: ${camera.nvrInstalled || "N/A"}
                            \nBattery SN: ${camera.batterySerialNo || "N/A"}`,
                            styles: { halign: 'left' }
                        },
                        {
                            content: `\nGPS SN: ${camera.gpsDeviceSerialNo || "N/A"}
                            \nGPS Installed: ${camera.gpsDeviceInstalled || "N/A"}
                            \nDC/AC Conv.: ${camera.dcAcConverterInstalled || "N/A"}
                            \nRouter BackSite: ${camera.internet4GRouterInstalledBackSite || "N/A"}
                            \nRouter Sim: ${camera.internet4GRouterSimNo || "N/A"}`,
                            styles: { halign: 'left' }
                        },
                        {
                            content: `\nStream Test: ${camera.successfulTestWebStreaming || "No"}
                            \nBattery Install: ${camera.batteryInstalledAtVehicle || "N/A"}
                            \nTraining Done: ${camera.trainingToDriverAndFSTMember || "N/A"}
                            \nPower Strip: ${camera.electricalPowerStripInstalled || "N/A"}
                            \nBack LCD: ${camera.backsideLCDInstalled || "No"}`,

                            styles: { halign: 'left' }
                        },
                    ]
                ],
                theme: 'grid',
                styles: { fontSize: 8, cellPadding: 4, overflow: 'linebreak', fillColor: [248, 250, 252] },
                columnStyles: {
                    0: { cellWidth: 65 },
                    1: { cellWidth: 65 },
                    2: { cellWidth: 65 },
                },
                margin: { left: 14, right: 14 }
            });

            finalY = doc.lastAutoTable.finalY + 10;
        });

        doc.save(`Mobile_App_Report_${moment().format("YYYYMMDD_HHmm")}.pdf`);
        setIsGlobalPdfLoading(false);
    };

const handleSingleRecordPDF = async (camera, uniqueId) => {
        setRowLoadingUniqueId(uniqueId);
        const doc = new jsPDF("p", "mm", "a4");

        // --- Page 1 Header Logic (Logo + Title) ---
        const logoData = await getImageDataUrl(vmLogo);
        if (logoData) {
            const logoWidth = 25;
            const logoHeight = 25;
            const xPos = (210 - logoWidth) / 2;
            doc.addImage(logoData, 'PNG', xPos, 8, logoWidth, logoHeight);
        }

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("West Bengal Assembly Election 2026", 105, 35, { align: "center" });
        doc.text("INSTALLATION REPORT OF FLYING SQUAD VEHICLE", 105, 42, { align: "center" });

        // --- TABLE 1: Vehicle & District Info ---
        doc.autoTable({
            startY: 50,
            theme: "grid",
            styles: { 
                fontSize: 9, 
                cellPadding: 2, 
                textColor: [0, 0, 0], 
                fontStyle: "bold",
                lineWidth: 0.3, // MAKES BORDERS BOLD
                lineColor: [0, 0, 0] // MAKES BORDERS BLACK
            },
            columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 90 } },
            body: [
                [`District Name: ${camera.district || camera.districtName || "N/A"}`, `AC Name: ${camera.assembly || camera.acName || "N/A"}`],
                [`Vehicle No: ${camera.vehicleNo || "N/A"}`, `Installation Date: ${camera.installationDate ? moment(camera.installationDate).format('YYYY-MM-DD') : "N/A"}`],
                [`Driver Name: ${camera.driverName || "N/A"}`, `Installation Site & Address: ${camera.installationSiteAddress || "N/A"}`],
                [`Driver Mobile No: ${camera.driverMobileNo || "N/A"}`, `Type of Vehicle: ${camera.typeOfVehicle || "N/A"}`],
                [`Created At: ${camera.createdAt ? moment(camera.createdAt).format('YYYY/MM/DD HH:mm') : "N/A"}`]
            ],
            margin: { left: 15 }
        });

        // --- TABLE 2: Equipment Checklist ---
        doc.autoTable({
            startY: doc.lastAutoTable.finalY + 5,
            theme: "grid",
            headStyles: { 
                fillColor: [255, 255, 255], 
                textColor: [0, 0, 0], 
                lineWidth: 0.3, // BOLD HEADER BORDER
                lineColor: [0, 0, 0], 
                halign: 'left' 
            },
            styles: { 
                fontSize: 9, 
                cellPadding: 2, 
                textColor: [0, 0, 0],
                lineWidth: 0.3, // BOLD BODY BORDERS
                lineColor: [0, 0, 0] 
            },
            head: [['DESCRIPTION', 'SERIAL NO', 'INSTALLED YES/NO']],
            body: [
                ['PTZ Camera Model number', camera.ptzCameraModelNumber || "N/A", ""],
                ['PTZ Camera ID', camera.ptzCameraSerialNumber || camera.deviceId || "N/A", ""],
                ['PTZ Camera installed on the vehicle', "", camera.ptzCameraInstalledOnVehicle || "No"],
                ['NVR Model No', camera.nvrModelNo || "N/A", ""],
                ['NVR Installed', "", camera.nvrInstalled || "No"],
                ['Battery Serial No.', camera.batterySerialNo || "N/A", ""],
                ['Battery installed at Vehicle', "", camera.batteryInstalledAtVehicle || "No"],
                ['Backside LCD Installed', "", camera.backsideLCDInstalled || "No"],
                ['GPS Device Serial No', camera.gpsDeviceSerialNo || "N/A", ""],
                ['GPS Device installed', "", camera.gpsDeviceInstalled || "No"],
                ['DC/AC Converter Installed', "", camera.dcAcConverterInstalled || "No"],
                ['Internet 4G Router installed back site', "", camera.internet4GRouterInstalledBackSite || "No"],
                ['Internet 4G Router SIM No.', camera.internet4GRouterSimNo || "N/A", ""],
                ['Electrical Power strip Installed', "", camera.electricalPowerStripInstalled || "No"],
                ['Training to Driver & FST Incharge', "", camera.trainingToDriverAndFSTMember || "No"],
                ['Successful Test Web-Streaming', "", camera.successfulTestWebStreaming || "No"]
            ],
            margin: { left: 15 }
        });

        // --- NOTE SECTION (Updated as per previous request) ---
        const finalY = doc.lastAutoTable.finalY + 8; 
        const marginLeft = 15;
        doc.setFontSize(7.5); // Reduced size
        
        doc.setFont("helvetica", "bold");
        doc.text("Note: ", marginLeft, finalY);
        
        doc.setFont("helvetica", "normal");
        const noteContent = "Henceforth, the equipment shall be in the custody of concerned Driver and Flying squad team Incharge. They shall ensure no damage is done to the equipment";
        const labelWidth = doc.getTextWidth("Note: ");
        const splitNote = doc.splitTextToSize(noteContent, 180 - labelWidth);
        doc.text(splitNote, marginLeft + labelWidth, finalY);

        // --- Page 2: Photos ---
        doc.addPage();
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Installation Photos", 105, 15, { align: "center" });

        const photoBoxWidth = 85;
        const photoBoxHeight = 65;
        const headerHeight = 8;

        const addImageToBox = async (url, x, y, title) => {
            doc.setDrawColor(200, 200, 200);
            doc.rect(x, y, photoBoxWidth, photoBoxHeight);
            doc.setFillColor(245, 245, 245);
            doc.rect(x, y, photoBoxWidth, headerHeight, 'F');
            doc.rect(x, y, photoBoxWidth, headerHeight);
            doc.setFontSize(10);
            doc.setTextColor(0, 0, 0);
            doc.text(title, x + (photoBoxWidth / 2), y + 5.5, { align: "center" });

            if (url) {
                const dataUrl = await getImageDataUrl(url);
                if (dataUrl) doc.addImage(dataUrl, 'JPEG', x + 2, y + headerHeight + 2, photoBoxWidth - 4, photoBoxHeight - headerHeight - 4);
                else doc.text("Image failed to load", x + (photoBoxWidth / 2), y + 35, { align: "center" });
            } else {
                doc.text("No photo provided", x + (photoBoxWidth / 2), y + 35, { align: "center" });
            }
        };

        await addImageToBox(camera.vehiclePhotoUrl, 15, 25, "Vehicle with Driver Photo");
        await addImageToBox(camera.localScreenPhotoUrl, 110, 25, "Local Screen Viewing");
        await addImageToBox(camera.streamScreenshotUrl, 15, 100, "Portal Stream Screenshot");

        doc.save(`${camera.vehicleNo}-${camera.acName}-${camera.districtName}.pdf`);
        setRowLoadingUniqueId(null);
    };
    // --- Pagination Helpers ---
    const totalPages = Math.ceil(filteredCameras.length / itemsPerPage);

    const getPageNumbers = () => {
        const pages = [];
        if (totalPages <= 5) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            if (currentPage <= 3) {
                pages.push(1, 2, 3, "...", totalPages);
            } else if (currentPage > totalPages - 3) {
                pages.push(1, "...", totalPages - 2, totalPages - 1, totalPages);
            } else {
                pages.push(1, "...", currentPage, "...", totalPages);
            }
        }
        return pages;
    };

    // --- Detail Helper ---
    const DataField = ({ label, value }) => (
        <HStack spacing={2} mb={1}>
            <Text fontWeight="600" fontSize="xs" color="gray.600" whiteSpace="nowrap">{label}:</Text>
            <Text fontSize="xs" color="black" fontWeight="500">{value || "N/A"}</Text>
        </HStack>
    );


    return (
        <Flex direction="column" h="100vh">
            <Box mb={2} zIndex="10" p={4}>
                <Flex justify="space-between" align="center" mb={4}>
                    <Text fontWeight={400} fontSize="26px" color={text}>Mobile App Report</Text>
                </Flex>

                <Flex justify="space-between" align="center" wrap="wrap" gap={4}>
                    <Grid templateColumns={{ base: "1fr", md: "repeat(6, auto)" }} gap={4} alignItems="center">
                        <Select placeholder="Select District" size="sm" w={"auto"} bg={buttonGradientColor} borderRadius="8px" value={selectedDistrictName} onChange={handleDistrictChange}>
                            {districtsList.map((d) => <option key={d} value={d}>{d}</option>)}
                        </Select>

                        <Select placeholder="Select Assembly" size="sm" w={"auto"} bg={buttonGradientColor} borderRadius="8px" value={selectedAssemblyValue} onChange={handleAssemblyChange} isDisabled={!selectedDistrictName}>
                            {assembliesList.map((a) => <option key={a} value={a}>{a}</option>)}
                        </Select>

                        <Select
                            placeholder={isVehicleLoading ? "Loading Vehicles..." : "Select Vehicle"}
                            size="sm"
                            w={"auto"}
                            value={searchLocation}
                            onChange={(e) => setSearchLocation(e.target.value)}
                            bg={buttonGradientColor}
                            borderRadius="8px"
                            fontSize={"12px"}
                            isDisabled={!selectedAssemblyValue}
                        >
                            {locationsList.map((loc) => (
                                <option key={loc} value={loc}>
                                    {loc}
                                </option>
                            ))}
                        </Select>

                        <RadioGroup onChange={setPsOption} value={psOption}>
                            <HStack>
                                <Radio value="ps" size="md" colorScheme="blue"><Text fontSize="13px" whiteSpace="nowrap">Vehicle No</Text></Radio>
                                <Text color="gray.400">|</Text>
                                <Radio value="camera" size="md" colorScheme="blue"><Text fontSize="13px" whiteSpace="nowrap">Camera ID</Text></Radio>
                            </HStack>
                        </RadioGroup>

                        <Input
                            placeholder={psOption === "ps" ? "Search Vehicle No" : "Search Camera ID"}
                            value={searchDeviceId}
                            onChange={handleSearchDeviceIdChange}
                            size="sm" width={"150px"} bg={buttonGradientColor} borderRadius={"8px"}
                        />

                        {/* Top Global PDF Button */}
                        <Button
                            bg={buttonGradientColor}
                            borderRadius="8px"
                            height="32px"
                            fontSize="12px"
                            color={"black"}
                            size="sm"
                            leftIcon={<FaFilePdf size={12} />}
                            onClick={handlePDFExport}
                            isLoading={isGlobalPdfLoading}
                            loadingText="Generating..."
                            border="1px solid #b3b8d6ff"
                        >
                            PDF
                        </Button>

                    </Grid>
                </Flex>
            </Box>

            {loading ? (
                <Flex justifyContent="center" alignItems="center" height="200px"><Spinner size="xl" color="blue.500" /></Flex>
            ) : (
                <Box px={4}>
                    <div style={tableContainerStyle}>
                        <Table variant="simple" size="sm">
                            <Thead>
                                <Tr style={tableHeaderRowStyle} bg={buttonGradientColor}>
                                    <Th style={tableHeaderStyle}>Sr No.<VerticalLine /></Th>
                                    <Th style={tableHeaderStyle}>District<VerticalLine /></Th>
                                    <Th style={tableHeaderStyle}>Assembly<VerticalLine /></Th>
                                    <Th style={tableHeaderStyle}>Device Id<VerticalLine /></Th>
                                    <Th style={tableHeaderStyle}>Vehicle No.<VerticalLine /></Th>
                                    <Th style={tableHeaderStyle}>Driver Name<VerticalLine /></Th>
                                    <Th style={tableHeaderStyle}>Driver Contact<VerticalLine /></Th>
                                    <Th style={tableHeaderStyle}>Equipment Details<VerticalLine /></Th>
                                    <Th style={tableHeaderStyle}></Th>
                                </Tr>
                            </Thead>
                            <Tbody>
                                {displayedCameras.length > 0 ? (
                                    displayedCameras.map((camera, index) => {
                                        const uniqueRowId = `${currentPage}-${index}`;
                                        return (
                                            <React.Fragment key={uniqueRowId}>
                                                <Tr>
                                                    <Td style={tableDataStyle}>{(currentPage - 1) * itemsPerPage + index + 1}<VerticalLine /></Td>
                                                    <Td style={tableDataStyle}>{camera.district || camera.districtName || "N/A"}<VerticalLine /></Td>
                                                    <Td style={tableDataStyle}>{camera.assembly || camera.acName || "N/A"}<VerticalLine /></Td>
                                                    <Td style={tableDataStyle}>{camera.deviceId || camera.ptzCameraSerialNumber || "N/A"}<VerticalLine /></Td>
                                                    <Td style={tableDataStyle}>{camera.vehicleNo || "N/A"}<VerticalLine /></Td>
                                                    <Td style={tableDataStyle}>{camera.driverName || "N/A"}<VerticalLine /></Td>
                                                    <Td style={tableDataStyle}>{camera.driverMobileNo || "N/A"}<VerticalLine /></Td>
                                                    <Td style={tableDataStyle}>
                                                        <Button
                                                            size="xs"
                                                            colorScheme="blue"
                                                            variant="outline"
                                                            rightIcon={expandedRows[index] ? <FaChevronUp /> : <FaChevronDown />}
                                                            onClick={() => toggleRow(index)}
                                                        >
                                                            Equipment Details
                                                        </Button>
                                                        <VerticalLine />
                                                    </Td>
                                                    <Td style={tableDataStyle}>
                                                        <IconButton
                                                            icon={<FaDownload />}
                                                            size="xs"
                                                            colorScheme="blue"
                                                            variant="ghost"
                                                            onClick={() => handleSingleRecordPDF(camera, uniqueRowId)}
                                                            isLoading={rowLoadingUniqueId === uniqueRowId}
                                                            aria-label="Download Report"
                                                        />
                                                    </Td>
                                                </Tr>

                                                <Tr>
                                                    <Td colSpan={9} p={0} border="none">
                                                        <Collapse in={expandedRows[index]} animateOpacity>
                                                            <Box m={3} p={4} bg="gray.50" borderRadius="8px" border="1px solid #e2e8f0">
                                                                <SimpleGrid columns={{ base: 1, md: 4 }} spacing={6}>
                                                                    <Box>
                                                                        <Text fontWeight="bold" fontSize="sm" color="blue.600" mb={2}>Installation Info</Text>
                                                                        <DataField label="Install Date" value={camera.installationDate ? moment(camera.installationDate).format('YYYY-MM-DD HH:mm') : "N/A"} />
                                                                        <DataField label="Site Address" value={camera.installationSiteAddress} />
                                                                        <DataField label="Vehicle Type" value={camera.typeOfVehicle} />
                                                                        <DataField label="Created By" value={camera.createdByMobile} />
                                                                        <DataField label="Created At" value={camera.createdAt ? moment(camera.createdAt).format('YYYY-MM-DD HH:mm') : "N/A"} />
                                                                        <DataField label="Stream Test" value={camera.successfulTestWebStreaming} />
                                                                    </Box>

                                                                    <Box>
                                                                        <Text fontWeight="bold" fontSize="sm" color="blue.600" mb={2}></Text>
                                                                        <DataField label="PTZ Model" value={camera.ptzCameraModelNumber} />
                                                                        <DataField label="PTZ Installed" value={camera.ptzCameraInstalledOnVehicle} />
                                                                        <DataField label="NVR Model" value={camera.nvrModelNo} />
                                                                        <DataField label="NVR Installed" value={camera.nvrInstalled} />
                                                                        <DataField label="Battery SN" value={camera.batterySerialNo} />
                                                                        <DataField label="Battery Install" value={camera.batteryInstalledAtVehicle} />
                                                                        <DataField label="Back LCD" value={camera.backsideLCDInstalled} />
                                                                    </Box>

                                                                    <Box>
                                                                        <Text fontWeight="bold" fontSize="sm" color="blue.600" mb={2}></Text>
                                                                        <DataField label="GPS SN" value={camera.gpsDeviceSerialNo} />
                                                                        <DataField label="GPS Installed" value={camera.gpsDeviceInstalled} />
                                                                        <DataField label="DC/AC Conv." value={camera.dcAcConverterInstalled} />
                                                                        <DataField label="Router BackSite" value={camera.internet4GRouterInstalledBackSite} />
                                                                        <DataField label="Router Sim" value={camera.internet4GRouterSimNo} />
                                                                        <DataField label="Power Strip" value={camera.electricalPowerStripInstalled} />
                                                                        <DataField label="Training Drive" value={camera.trainingToDriverAndFSTMember} />
                                                                    </Box>

                                                                  

                                                                    <Box>
                                                                        <Text fontWeight="bold" fontSize="sm" color="blue.600" mb={2}></Text>
                                                                        <SimpleGrid columns={3} spacing={2}>
                                                                            <Box textAlign="center">
                                                                                <IconButton
                                                                                    aria-label="Download Local Screen"
                                                                                    icon={<FaDownload />}
                                                                                    size="md"
                                                                                    colorScheme="blue"
                                                                                    onClick={() => handleDownload(camera.localScreenPhotoUrl, `local_screen_${camera.deviceId}.jpg`)}
                                                                                />
                                                                                <Text fontSize="10px" mt={2} fontWeight="500">Local Screen</Text>
                                                                            </Box>
                                                                            <Box textAlign="center">
                                                                                <IconButton
                                                                                    aria-label="Download Stream Shot"
                                                                                    icon={<FaDownload />}
                                                                                    size="md"
                                                                                    colorScheme="blue"
                                                                                    onClick={() => handleDownload(camera.streamScreenshotUrl, `stream_shot_${camera.deviceId}.jpg`)}
                                                                                />
                                                                                <Text fontSize="10px" mt={2} fontWeight="500">Stream Shot</Text>
                                                                            </Box>
                                                                            <Box textAlign="center">
                                                                                <IconButton
                                                                                    aria-label="Download Vehicle Photo"
                                                                                    icon={<FaDownload />}
                                                                                    size="md"
                                                                                    colorScheme="blue"
                                                                                    onClick={() => handleDownload(camera.vehiclePhotoUrl, `vehicle_${camera.deviceId}.jpg`)}
                                                                                />
                                                                                <Text fontSize="10px" mt={2} fontWeight="500">Vehicle Photo</Text>
                                                                            </Box>
                                                                        </SimpleGrid>
                                                                    </Box>

                                                                </SimpleGrid>
                                                            </Box>
                                                        </Collapse>
                                                    </Td>
                                                </Tr>
                                            </React.Fragment>
                                        );
                                    })
                                ) : (
                                    <Tr><Td colSpan="9" textAlign="center" p={10}>No Records found.</Td></Tr>
                                )}
                            </Tbody>
                        </Table>
                    </div>

                    <Flex mt={4} justify="center" align="center" pb={6}>
                        <HStack spacing={2}>
                            <Button
                                size="sm"
                                px={4}
                                bg="#dce5f0"
                                color="gray.500"
                                fontWeight="bold"
                                fontSize="14px"
                                borderRadius="10px"
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                isDisabled={currentPage === 1}
                                _hover={{ bg: "#cfd9e6" }}
                            >
                                Previous
                            </Button>

                            {getPageNumbers().map((page, index) => (
                                page === "..." ? (
                                    <Text key={index} fontWeight="bold" fontSize="14px" px={1} color="black">...</Text>
                                ) : (
                                    <Button
                                        key={index}
                                        size="sm"
                                        minW="35px"
                                        bg={currentPage === page ? "#90cdf4" : "#dce5f0"}
                                        color="black"
                                        fontWeight="bold"
                                        fontSize="14px"
                                        borderRadius="10px"
                                        textDecoration={currentPage === page ? "underline" : "none"}
                                        onClick={() => setCurrentPage(page)}
                                        _hover={{ bg: currentPage === page ? "#90cdf4" : "#cfd9e6" }}
                                    >
                                        {page}
                                    </Button>
                                )
                            ))}

                            <Button
                                size="sm"
                                px={4}
                                bg="#dce5f0"
                                color="black"
                                fontWeight="bold"
                                fontSize="14px"
                                borderRadius="10px"
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredCameras.length / itemsPerPage)))}
                                isDisabled={currentPage === Math.ceil(filteredCameras.length / itemsPerPage) || Math.ceil(filteredCameras.length / itemsPerPage) === 0}
                                _hover={{ bg: "#cfd9e6" }}
                            >
                                Next
                            </Button>
                        </HStack>
                    </Flex>
                </Box>
            )}

            <Modal isOpen={isOpen} onClose={handleCloseModal} size="xl" isCentered>
                <ModalOverlay backdropFilter="blur(5px)" />
                <ModalContent bg="gray.900" color="white">
                    <ModalHeader>{selectedCamera?.deviceId} <Badge ml={3} colorScheme="green">LIVE</Badge></ModalHeader>
                    <ModalCloseButton />
                    <ModalBody pb={6}>
                        {streamUrl && <Box ref={containerRef} position="relative" height={isFs ? "100vh" : "400px"}>
                            <Player device={selectedCamera} initialPlayUrl={streamUrl} muted={isMuted} style={{ width: "100%", height: isFs ? "100vh" : "400px" }} />
                            <HStack position="absolute" bottom="15px" right="15px" zIndex="20">
                                <IconButton variant="solid" size="sm" icon={isMuted ? <BsVolumeMute /> : <BsVolumeUp />} onClick={() => setIsMuted(!isMuted)} aria-label="Mute" />
                                <IconButton variant="solid" size="sm" icon={<BsArrowsFullscreen />} onClick={toggleFullscreen} aria-label="FS" />
                            </HStack>
                        </Box>}
                    </ModalBody>
                </ModalContent>
            </Modal>
        </Flex>
    );
};

export default GpsTrackingMap;