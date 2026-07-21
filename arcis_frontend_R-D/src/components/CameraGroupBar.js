import {
  Box,
  Flex,
  HStack,
  VStack,
  Text,
  Button,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Badge,
  Tooltip,
  Divider,
  Circle,
  Switch,
  useDisclosure,
  useColorModeValue,
  useToast,
} from "@chakra-ui/react";
import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import {
  MdAdd,
  MdClose,
  MdEdit,
  MdDragIndicator,
  MdSearch,
  MdDeleteOutline,
  MdVideocam,
} from "react-icons/md";
import Player from "./Player";
import SimpleFLVPlayer from "./SimpleFLVPlayer";

// -----------------------------------------------------------------------------
// Lazy live preview — a stable, module-level component (NOT defined inside the
// parent) so it doesn't remount on every keystroke. It starts streaming when it
// first scrolls into view, then stays mounted to avoid create/destroy churn.
// -----------------------------------------------------------------------------
const LazyPreview = React.memo(
  function LazyPreview({ cam, generateStreamUrl }) {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
      const el = ref.current;
      if (!el || typeof IntersectionObserver === "undefined") {
        setVisible(true);
        return;
      }
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              setVisible(true);
              obs.disconnect(); // load once, keep mounted
            }
          });
        },
        { root: null, rootMargin: "150px", threshold: 0.01 }
      );
      obs.observe(el);
      return () => obs.disconnect();
    }, []);

    const url = typeof generateStreamUrl === "function" ? generateStreamUrl(cam) : "";
    const isSSAN = cam.deviceId && cam.deviceId.startsWith("SSAN");
    const isOnline = !!cam.status;
    // Attempt a preview whenever we have a stream URL. The `status` flag isn't a
    // reliable indicator of stream availability (some cameras marked "offline"
    // still stream), so we don't gate on it — dead streams fail harmlessly now
    // that the player teardown/replay races are guarded at the source.
    const canStream = !!url;
    // Width-driven sizing with a 16:9 aspect ratio — this is how the main grid
    // drives the Player, so the video fills the box correctly instead of
    // collapsing to zero height.
    const previewStyle = { width: "100%", height: "auto", aspectRatio: "16 / 9", borderRadius: "6px" };

    return (
      <Box
        ref={ref}
        w="120px"
        flexShrink={0}
        borderRadius="6px"
        overflow="hidden"
        bg="black"
        position="relative"
        sx={{ aspectRatio: "16 / 9" }}
      >
        <Circle
          size="8px"
          bg={isOnline ? "green.400" : "red.400"}
          position="absolute"
          top="4px"
          left="4px"
          zIndex="2"
          boxShadow="0 0 0 2px rgba(0,0,0,0.5)"
        />
        {visible && canStream ? (
          isSSAN ? (
            <SimpleFLVPlayer url={url} style={previewStyle} muted={true} />
          ) : (
            <Player
              device={cam}
              initialPlayUrl={url}
              width="100%"
              style={previewStyle}
              showControls={false}
              showOverlay={false}
              muted={true}
            />
          )
        ) : (
          <Flex position="absolute" inset="0" align="center" justify="center" direction="column" gap={0.5}>
            <Box as={MdVideocam} color="whiteAlpha.500" fontSize="20px" />
            {!isOnline && (
              <Text fontSize="8px" color="whiteAlpha.600" fontWeight="600">
                OFFLINE
              </Text>
            )}
          </Flex>
        )}
      </Box>
    );
  },
  // Only re-render (never remount) when the camera or its status changes.
  (prev, next) =>
    prev.cam.deviceId === next.cam.deviceId && prev.cam.status === next.cam.status
);

// -----------------------------------------------------------------------------
// Camera card — also stable/module-level. Click toggles membership; the whole
// card is draggable between the two panels.
// -----------------------------------------------------------------------------
const CamCard = React.memo(
  function CamCard({ cam, inGroup, showPreviews, onToggle, generateStreamUrl }) {
    const cardBg = useColorModeValue("white", "whiteAlpha.100");
    const cardHover = useColorModeValue("gray.100", "whiteAlpha.200");
    const border = useColorModeValue("gray.300", "whiteAlpha.300");
    const textCol = useColorModeValue("gray.800", "white");
    const subText = useColorModeValue("gray.500", "gray.400");

    return (
      <Flex
        draggable
        onDragStart={(e) => e.dataTransfer.setData("text/plain", cam.deviceId)}
        onClick={() => onToggle(cam.deviceId)}
        align="center"
        gap={2}
        px={2}
        py={1.5}
        borderRadius="md"
        bg={cardBg}
        borderWidth="1px"
        borderColor="transparent"
        _hover={{ bg: cardHover, borderColor: border }}
        cursor="grab"
        transition="all 0.12s ease"
      >
        <Box as={MdDragIndicator} color={subText} flexShrink={0} />
        {showPreviews ? (
          <LazyPreview cam={cam} generateStreamUrl={generateStreamUrl} />
        ) : (
          <Circle size="9px" bg={cam.status ? "green.400" : "red.400"} flexShrink={0} />
        )}
        <Box flex="1" minW={0}>
          <Text fontSize="12px" fontWeight="600" color={textCol} noOfLines={1}>
            {cam.deviceId}
          </Text>
          <Text fontSize="10px" color={subText} noOfLines={1}>
            {cam.dist_name || cam.name || "—"}
            {cam.operatorName ? ` · ${cam.operatorName}` : ""}
          </Text>
        </Box>
        <Box
          as={inGroup ? MdClose : MdAdd}
          color={inGroup ? "red.400" : "blue.400"}
          flexShrink={0}
          opacity={0.85}
        />
      </Flex>
    );
  },
  (prev, next) =>
    prev.cam.deviceId === next.cam.deviceId &&
    prev.cam.status === next.cam.status &&
    prev.inGroup === next.inGroup &&
    prev.showPreviews === next.showPreviews
);

// Persistent, theme-aware camera group manager for the Multi View page.
// Groups are stored/updated by the parent (MultipleView) and persisted to
// localStorage there. This component renders the selector pills and the
// create/edit modal (with click-to-add and drag-and-drop support).
function CameraGroupBar({
  allCameras = [],
  groups = [],
  setGroups,
  selectedGroupId,
  onSelectGroup,
  generateStreamUrl,
}) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();

  const [editingId, setEditingId] = useState(null);
  const [groupName, setGroupName] = useState("");
  const [draftIds, setDraftIds] = useState([]); // ordered deviceIds in the group
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState(null); // "group" | "available" | null
  const [showPreviews, setShowPreviews] = useState(true);

  // --- Theme tokens (aligned with the rest of the app) ---
  const barBg = useColorModeValue("custom.primary", "custom.darkModePrimary");
  const pillBg = useColorModeValue("whiteAlpha.700", "whiteAlpha.100");
  const pillBorder = useColorModeValue("gray.300", "whiteAlpha.300");
  const textCol = useColorModeValue("gray.800", "white");
  const subText = useColorModeValue("gray.500", "gray.400");
  const panelBg = useColorModeValue("gray.50", "rgba(255,255,255,0.04)");
  const panelBorder = useColorModeValue("gray.200", "whiteAlpha.200");
  const cardBg = useColorModeValue("white", "whiteAlpha.100");
  const cardHover = useColorModeValue("gray.100", "whiteAlpha.200");
  const dropActiveBorder = "blue.400";
  const dropActiveBg = useColorModeValue("blue.50", "rgba(66,153,225,0.12)");
  const modalBg = useColorModeValue("white", "#1A202C");

  const cameraById = useMemo(() => {
    const map = {};
    allCameras.forEach((c) => {
      if (c && c.deviceId) map[c.deviceId] = c;
    });
    return map;
  }, [allCameras]);

  const availableCameras = useMemo(() => {
    const term = search.trim().toLowerCase();
    const draftSet = new Set(draftIds);
    const seen = new Set();
    return allCameras
      .filter((c) => {
        // valid, not already in the group, and de-duplicated by deviceId
        if (!c || !c.deviceId || draftSet.has(c.deviceId)) return false;
        if (seen.has(c.deviceId)) return false;
        seen.add(c.deviceId);
        return true;
      })
      .filter((c) => {
        if (!term) return true;
        return (
          (c.deviceId || "").toLowerCase().includes(term) ||
          (c.name || "").toLowerCase().includes(term) ||
          (c.dist_name || "").toLowerCase().includes(term) ||
          (c.accName || "").toLowerCase().includes(term) ||
          (c.operatorName || "").toLowerCase().includes(term)
        );
      });
  }, [allCameras, draftIds, search]);

  const groupCameras = useMemo(
    () => draftIds.map((id) => cameraById[id]).filter(Boolean),
    [draftIds, cameraById]
  );

  // --- Stable draft helpers (so memoized cards don't churn) ---
  const addId = useCallback(
    (id) => setDraftIds((prev) => (prev.includes(id) ? prev : [...prev, id])),
    []
  );
  const removeId = useCallback(
    (id) => setDraftIds((prev) => prev.filter((x) => x !== id)),
    []
  );
  const toggleId = useCallback(
    (id) =>
      setDraftIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      ),
    []
  );

  const handleDrop = (target, e) => {
    e.preventDefault();
    setDragOver(null);
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    if (target === "group") addId(id);
    else removeId(id);
  };

  const allowDrop = (target, e) => {
    e.preventDefault();
    if (dragOver !== target) setDragOver(target);
  };

  // --- Open handlers ---
  const openCreate = () => {
    setEditingId(null);
    setGroupName("");
    setDraftIds([]);
    setSearch("");
    onOpen();
  };

  const openEdit = (group, e) => {
    if (e) e.stopPropagation();
    setEditingId(group.id);
    setGroupName(group.name);
    setDraftIds([...(group.deviceIds || [])]);
    setSearch("");
    onOpen();
  };

  const handleSave = () => {
    const name = groupName.trim();
    if (!name) {
      toast({ title: "Please enter a group name", status: "warning", duration: 2000, isClosable: true });
      return;
    }
    if (draftIds.length === 0) {
      toast({ title: "Add at least one camera to the group", status: "warning", duration: 2000, isClosable: true });
      return;
    }
    if (editingId) {
      setGroups((prev) =>
        prev.map((g) => (g.id === editingId ? { ...g, name, deviceIds: draftIds } : g))
      );
    } else {
      const id = `grp_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      setGroups((prev) => [...prev, { id, name, deviceIds: draftIds }]);
      onSelectGroup(id);
    }
    toast({ title: editingId ? "Group updated" : "Group created", status: "success", duration: 1800, isClosable: true });
    onClose();
  };

  const handleDelete = (id, e) => {
    if (e) e.stopPropagation();
    setGroups((prev) => prev.filter((g) => g.id !== id));
    if (selectedGroupId === id) onSelectGroup(null);
  };

  return (
    <>
      {/* --- Group selector bar --- */}
      <Flex
        align="center"
        gap={2}
        mb={3}
        px={2}
        py={2}
        borderRadius="10px"
        bg={barBg}
        overflowX="auto"
        css={{
          "&::-webkit-scrollbar": { height: "6px" },
          "&::-webkit-scrollbar-thumb": { background: "rgba(0,0,0,0.2)", borderRadius: "3px" },
        }}
      >
        <Text fontSize="12px" fontWeight="700" color={textCol} pl={1} pr={1} flexShrink={0}>
          Groups:
        </Text>

        {/* All Cameras (default) */}
        <Button
          size="xs"
          flexShrink={0}
          borderRadius="full"
          onClick={() => onSelectGroup(null)}
          bg={selectedGroupId === null ? "blue.400" : pillBg}
          color={selectedGroupId === null ? "white" : textCol}
          borderWidth="1px"
          borderColor={selectedGroupId === null ? "blue.400" : pillBorder}
          _hover={{ bg: selectedGroupId === null ? "blue.500" : cardHover }}
        >
          All Cameras
          <Badge ml={2} borderRadius="full" fontSize="9px" colorScheme={selectedGroupId === null ? "whiteAlpha" : "gray"}>
            {allCameras.length}
          </Badge>
        </Button>

        {/* Group pills */}
        {groups.map((g) => {
          const active = selectedGroupId === g.id;
          return (
            <HStack
              key={g.id}
              spacing={0}
              flexShrink={0}
              borderRadius="full"
              borderWidth="1px"
              borderColor={active ? "blue.400" : pillBorder}
              bg={active ? "blue.400" : pillBg}
              overflow="hidden"
            >
              <Button
                size="xs"
                variant="unstyled"
                px={3}
                h="24px"
                display="inline-flex"
                alignItems="center"
                borderRadius="0"
                color={active ? "white" : textCol}
                onClick={() => onSelectGroup(g.id)}
                fontWeight="600"
              >
                {g.name}
                <Badge ml={2} borderRadius="full" fontSize="9px" colorScheme={active ? "whiteAlpha" : "gray"}>
                  {g.deviceIds?.length || 0}
                </Badge>
              </Button>
              <Tooltip label="Edit group" fontSize="xs">
                <IconButton
                  size="xs"
                  variant="ghost"
                  h="24px"
                  minW="22px"
                  borderRadius="0"
                  color={active ? "whiteAlpha.900" : subText}
                  _hover={{ bg: active ? "blue.500" : cardHover }}
                  icon={<MdEdit />}
                  aria-label="Edit group"
                  onClick={(e) => openEdit(g, e)}
                />
              </Tooltip>
              <Tooltip label="Delete group" fontSize="xs">
                <IconButton
                  size="xs"
                  variant="ghost"
                  h="24px"
                  minW="22px"
                  borderRadius="0"
                  color={active ? "whiteAlpha.900" : "red.400"}
                  _hover={{ bg: active ? "blue.500" : cardHover }}
                  icon={<MdDeleteOutline />}
                  aria-label="Delete group"
                  onClick={(e) => handleDelete(g.id, e)}
                />
              </Tooltip>
            </HStack>
          );
        })}

        {/* Create button */}
        <Button
          size="xs"
          flexShrink={0}
          leftIcon={<MdAdd />}
          borderRadius="full"
          colorScheme="blue"
          variant="solid"
          onClick={openCreate}
          ml="auto"
        >
          Create Group
        </Button>
      </Flex>

      {/* --- Create / Edit modal --- */}
      <Modal isOpen={isOpen} onClose={onClose} size={{ base: "full", md: "4xl" }} scrollBehavior="inside" isCentered>
        <ModalOverlay bg="blackAlpha.800" backdropFilter="blur(6px)" />
        <ModalContent bg={modalBg} color={textCol} borderRadius={{ base: 0, md: "16px" }}>
          <ModalHeader borderBottomWidth="1px" borderColor={panelBorder} display="flex" alignItems="center" gap={2}>
            <Box as={MdVideocam} color="blue.400" />
            {editingId ? "Edit Camera Group" : "Create Camera Group"}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody py={4}>
            <VStack align="stretch" spacing={4}>
              <Box>
                <Text fontSize="12px" fontWeight="700" mb={1} color={subText} textTransform="uppercase">
                  Group Name
                </Text>
                <Input
                  placeholder="e.g. Main Gate, Ward 5, Highway Cams"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  bg={panelBg}
                  borderColor={panelBorder}
                  borderRadius="10px"
                />
              </Box>

              <Divider borderColor={panelBorder} />

              <Flex align="center" justify="space-between" gap={2} flexWrap="wrap">
                <Text fontSize="11px" color={subText}>
                  Add cameras by <b>clicking</b> them, or <b>drag &amp; drop</b> between the two lists.
                </Text>
                <HStack spacing={2} flexShrink={0}>
                  <Text fontSize="11px" fontWeight="600" color={subText}>
                    Live previews
                  </Text>
                  <Switch
                    size="sm"
                    colorScheme="blue"
                    isChecked={showPreviews}
                    onChange={(e) => setShowPreviews(e.target.checked)}
                  />
                </HStack>
              </Flex>

              <Flex gap={4} direction={{ base: "column", md: "row" }}>
                {/* Available */}
                <Box
                  flex="1"
                  minW={0}
                  onDrop={(e) => handleDrop("available", e)}
                  onDragOver={(e) => allowDrop("available", e)}
                  onDragLeave={() => setDragOver(null)}
                  bg={dragOver === "available" ? dropActiveBg : panelBg}
                  border="1px dashed"
                  borderColor={dragOver === "available" ? dropActiveBorder : panelBorder}
                  borderRadius="12px"
                  p={2}
                  transition="all 0.12s ease"
                >
                  <Flex align="center" justify="space-between" mb={2} px={1}>
                    <Text fontSize="12px" fontWeight="700" color={textCol}>
                      Available Cameras
                    </Text>
                    <Badge colorScheme="gray" borderRadius="full">{availableCameras.length}</Badge>
                  </Flex>
                  <InputGroup size="sm" mb={2}>
                    <InputLeftElement pointerEvents="none" color={subText}>
                      <MdSearch />
                    </InputLeftElement>
                    <Input
                      placeholder="Search camera…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      bg={cardBg}
                      borderColor={panelBorder}
                      borderRadius="8px"
                    />
                  </InputGroup>
                  <VStack align="stretch" spacing={1.5} maxH="320px" minH="120px" overflowY="auto" pr={1}>
                    {availableCameras.length > 0 ? (
                      availableCameras.map((cam) => (
                        <CamCard
                          key={cam.deviceId}
                          cam={cam}
                          inGroup={false}
                          showPreviews={showPreviews}
                          onToggle={toggleId}
                          generateStreamUrl={generateStreamUrl}
                        />
                      ))
                    ) : (
                      <Flex h="100px" align="center" justify="center">
                        <Text fontSize="11px" color={subText}>
                          {search ? "No matching cameras" : "All cameras added"}
                        </Text>
                      </Flex>
                    )}
                  </VStack>
                </Box>

                {/* In group */}
                <Box
                  flex="1"
                  minW={0}
                  onDrop={(e) => handleDrop("group", e)}
                  onDragOver={(e) => allowDrop("group", e)}
                  onDragLeave={() => setDragOver(null)}
                  bg={dragOver === "group" ? dropActiveBg : panelBg}
                  border="1px dashed"
                  borderColor={dragOver === "group" ? dropActiveBorder : panelBorder}
                  borderRadius="12px"
                  p={2}
                  transition="all 0.12s ease"
                >
                  <Flex align="center" justify="space-between" mb={2} px={1}>
                    <Text fontSize="12px" fontWeight="700" color={textCol}>
                      In this group
                    </Text>
                    <Badge colorScheme="blue" borderRadius="full">{groupCameras.length}</Badge>
                  </Flex>
                  <VStack align="stretch" spacing={1.5} maxH="365px" minH="120px" overflowY="auto" pr={1}>
                    {groupCameras.length > 0 ? (
                      groupCameras.map((cam) => (
                        <CamCard
                          key={cam.deviceId}
                          cam={cam}
                          inGroup={true}
                          showPreviews={showPreviews}
                          onToggle={toggleId}
                          generateStreamUrl={generateStreamUrl}
                        />
                      ))
                    ) : (
                      <Flex h="140px" align="center" justify="center" direction="column" gap={1}>
                        <Box as={MdAdd} fontSize="22px" color={subText} />
                        <Text fontSize="11px" color={subText} textAlign="center">
                          Drop cameras here or click them on the left
                        </Text>
                      </Flex>
                    )}
                  </VStack>
                </Box>
              </Flex>
            </VStack>
          </ModalBody>
          <ModalFooter borderTopWidth="1px" borderColor={panelBorder} gap={3}>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleSave} leftIcon={<MdVideocam />}>
              {editingId ? "Save Changes" : "Create Group"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

export default CameraGroupBar;
