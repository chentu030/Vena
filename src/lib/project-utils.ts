import {
    Folder, BookOpen, Beaker, Lightbulb, Star, Heart, Zap, Target, Compass,
    Rocket, Anchor, Archive, Award, Briefcase, Calendar, Camera, Cloud, Code,
    Coffee, Command, Database, Disc, DollarSign, Droplet, Eye, File, FileText, Film, Flag, Gift,
    Globe, Headphones, Home, Image, Key, Layers, Layout, Link, Lock, Map,
    MessageCircle, Mic, Monitor, Moon, Music, Package, PenTool, Phone, Play,
    Power, Printer, Radio, Save, Scissors, Search, Send, Server, Settings,
    Share, Shield, ShoppingBag, Smartphone, Speaker, Sun, Tablet, Tag, Terminal,
    Thermometer, ThumbsUp, Trash, Truck, Tv, Umbrella, Unlock, User,
    Video, Voicemail, Volume2, Watch, Wifi, Wind, Wrench, Activity, AlertCircle,
    AlignLeft, ArrowRight, BarChart, Bell, Bluetooth, Bold, Bookmark, Box,
    Cast, Check, ChevronRight, Clipboard, Clock, Copy, CreditCard, Crop, Crosshair,
    Delete, Download, Edit, ExternalLink, Facebook, Feather, Filter, Grid, Hash,
    HelpCircle, Info, Instagram, Linkedin, List, Loader, Mail, Menu, MessageSquare,
    Minus, MoreHorizontal, MousePointer, Move, Navigation, Octagon, Paperclip,
    Pause, Percent, PieChart, Plus, Pocket, PowerOff, RefreshCw, Repeat, RotateCcw,
    Rss, Scissors as ScissorsIcon, Sidebar, Slash, Sliders, Smile, Speaker as SpeakerIcon,
    Square, StopCircle, Table, ToggleLeft, Trash2, TrendingUp, Triangle, Truck as TruckIcon,
    Type, Upload, UserCheck, UserMinus, UserPlus, UserX, Users, Vibrate, View,
    Volume, Volume1, VolumeX, Wallet, Webcam, X, Youtube, ZoomIn, ZoomOut
} from 'lucide-react';

// Icon options for projects - expanded to 100+ items
export const ICON_OPTIONS = [
    // Essentials
    { name: 'Folder', icon: Folder, tags: ['file', 'organize'] },
    { name: 'BookOpen', icon: BookOpen, tags: ['read', 'study'] },
    { name: 'Beaker', icon: Beaker, tags: ['science', 'experiment'] },
    { name: 'Lightbulb', icon: Lightbulb, tags: ['idea', 'creative'] },
    { name: 'Star', icon: Star, tags: ['favorite', 'rating'] },
    { name: 'Heart', icon: Heart, tags: ['love', 'like'] },
    { name: 'Zap', icon: Zap, tags: ['power', 'energy'] },
    { name: 'Target', icon: Target, tags: ['goal', 'aim'] },
    { name: 'Compass', icon: Compass, tags: ['navigation', 'direction'] },
    { name: 'Rocket', icon: Rocket, tags: ['launch', 'space'] },
    { name: 'Home', icon: Home, tags: ['house', 'main'] },
    { name: 'Settings', icon: Settings, tags: ['config', 'gear'] },
    { name: 'User', icon: User, tags: ['person', 'profile'] },
    { name: 'Users', icon: Users, tags: ['team', 'group'] },
    { name: 'Calendar', icon: Calendar, tags: ['date', 'event'] },
    { name: 'Clock', icon: Clock, tags: ['time', 'schedule'] },
    { name: 'Search', icon: Search, tags: ['find', 'query'] },
    { name: 'Bell', icon: Bell, tags: ['notification', 'alert'] },
    { name: 'Mail', icon: Mail, tags: ['email', 'message'] },
    { name: 'MessageCircle', icon: MessageCircle, tags: ['chat', 'talk'] },

    // Tech & Dev
    { name: 'Code', icon: Code, tags: ['dev', 'programming'] },
    { name: 'Terminal', icon: Terminal, tags: ['command', 'console'] },
    { name: 'Database', icon: Database, tags: ['storage', 'sql'] },
    { name: 'Server', icon: Server, tags: ['backend', 'hosting'] },
    { name: 'Cloud', icon: Cloud, tags: ['weather', 'storage'] },
    { name: 'Link', icon: Link, tags: ['url', 'connection'] },
    { name: 'Wifi', icon: Wifi, tags: ['internet', 'connection'] },
    { name: 'Monitor', icon: Monitor, tags: ['screen', 'display'] },
    { name: 'Smartphone', icon: Smartphone, tags: ['mobile', 'device'] },
    { name: 'Laptop', icon: Monitor, tags: ['computer', 'work'] }, // Reusing Monitor as Laptop fallback if not imported
    { name: 'Keyboard', icon: Command, tags: ['input', 'type'] }, // Using Command as proxy
    { name: 'MousePointer', icon: MousePointer, tags: ['cursor', 'click'] },

    // Office & Work
    { name: 'Briefcase', icon: Briefcase, tags: ['job', 'business'] },
    { name: 'Archive', icon: Archive, tags: ['storage', 'history'] },
    { name: 'Award', icon: Award, tags: ['achievement', 'medal'] },
    { name: 'BarChart', icon: BarChart, tags: ['stats', 'analytics'] },
    { name: 'PieChart', icon: PieChart, tags: ['data', 'graph'] },
    { name: 'TrendingUp', icon: TrendingUp, tags: ['growth', 'stats'] },
    { name: 'ClipBoard', icon: Clipboard, tags: ['copy', 'paste'] },
    { name: 'File', icon: File, tags: ['document', 'paper'] },
    { name: 'FileText', icon: FileText, tags: ['txt', 'doc'] },
    { name: 'Paperclip', icon: Paperclip, tags: ['attachment', 'connect'] },
    { name: 'Printer', icon: Printer, tags: ['print', 'output'] },
    { name: 'Trash', icon: Trash, tags: ['delete', 'remove'] },

    // Creative & Media
    { name: 'Image', icon: Image, tags: ['photo', 'picture'] },
    { name: 'Camera', icon: Camera, tags: ['photo', 'capture'] },
    { name: 'Video', icon: Video, tags: ['movie', 'record'] },
    { name: 'Film', icon: Film, tags: ['cinema', 'movie'] },
    { name: 'Music', icon: Music, tags: ['audio', 'song'] },
    { name: 'Headphones', icon: Headphones, tags: ['listen', 'audio'] },
    { name: 'Mic', icon: Mic, tags: ['record', 'voice'] },
    { name: 'Speaker', icon: Speaker, tags: ['sound', 'volume'] },
    { name: 'PenTool', icon: PenTool, tags: ['draw', 'design'] },
    { name: 'Palette', icon: PenTool, tags: ['color', 'art'] }, // Using PenTool proxy or Palette if available
    { name: 'Edit', icon: Edit, tags: ['change', 'write'] },
    { name: 'Layers', icon: Layers, tags: ['stack', 'design'] },
    { name: 'Layout', icon: Layout, tags: ['grid', 'ui'] },

    // Objects & Tools
    { name: 'Key', icon: Key, tags: ['lock', 'security'] },
    { name: 'Lock', icon: Lock, tags: ['secure', 'closed'] },
    { name: 'Unlock', icon: Unlock, tags: ['open', 'access'] },
    // { name: 'Tool', icon: Tool, tags: ['fix', 'repair'] }, // Removed as not exported
    { name: 'Wrench', icon: Wrench, tags: ['fix', 'setup'] },
    { name: 'Hammer', icon: Wrench, tags: ['build', 'construct'] }, // Using Wrench as fallback for Hammer if Tool is missing
    { name: 'Scissors', icon: Scissors, tags: ['cut', 'snip'] },
    { name: 'Tag', icon: Tag, tags: ['label', 'price'] },
    { name: 'Gift', icon: Gift, tags: ['present', 'box'] },
    { name: 'Package', icon: Package, tags: ['box', 'deliver'] },
    { name: 'ShoppingBag', icon: ShoppingBag, tags: ['buy', 'store'] },
    { name: 'CreditCard', icon: CreditCard, tags: ['money', 'pay'] },
    { name: 'DollarSign', icon: DollarSign, tags: ['money', 'cash'] },
    { name: 'Wallet', icon: Wallet, tags: ['money', 'save'] },
    { name: 'Map', icon: Map, tags: ['location', 'place'] },
    { name: 'Globe', icon: Globe, tags: ['world', 'web'] },
    { name: 'Flag', icon: Flag, tags: ['mark', 'country'] },

    // Nature & Science
    { name: 'Sun', icon: Sun, tags: ['day', 'light'] },
    { name: 'Moon', icon: Moon, tags: ['night', 'dark'] },
    // { name: 'Cloud', icon: Cloud, tags: ['sky', 'weather'] }, // Duplicate removed
    { name: 'Wind', icon: Wind, tags: ['air', 'blow'] },
    { name: 'Droplet', icon: Droplet, tags: ['water', 'liquid'] },
    { name: 'Thermometer', icon: Thermometer, tags: ['temp', 'heat'] },
    { name: 'Activity', icon: Activity, tags: ['health', 'pulse'] },

    // Miscellaneous
    { name: 'Anchor', icon: Anchor, tags: ['sea', 'marine'] },
    { name: 'Coffee', icon: Coffee, tags: ['drink', 'break'] },
    { name: 'Truck', icon: Truck, tags: ['move', 'car'] },
    { name: 'Umbrella', icon: Umbrella, tags: ['rain', 'cover'] },
    { name: 'Watch', icon: Watch, tags: ['time', 'wear'] },
    { name: 'Shield', icon: Shield, tags: ['guard', 'protect'] },
    { name: 'Info', icon: Info, tags: ['help', 'about'] },
    { name: 'HelpCircle', icon: HelpCircle, tags: ['question', 'support'] },
    { name: 'AlertCircle', icon: AlertCircle, tags: ['warning', 'error'] },
    { name: 'Check', icon: Check, tags: ['ok', 'yes'] },
    { name: 'X', icon: X, tags: ['no', 'cancel'] },
    { name: 'Plus', icon: Plus, tags: ['add', 'new'] },
    { name: 'Minus', icon: Minus, tags: ['remove', 'less'] },
    { name: 'Hash', icon: Hash, tags: ['number', 'tag'] },
    { name: 'Grid', icon: Grid, tags: ['table', 'layout'] },
    { name: 'List', icon: List, tags: ['menu', 'items'] },
    { name: 'MoreHorizontal', icon: MoreHorizontal, tags: ['dots', 'menu'] },
    { name: 'Filter', icon: Filter, tags: ['sort', 'refine'] },
    { name: 'RefreshCw', icon: RefreshCw, tags: ['reload', 'update'] },
    { name: 'Download', icon: Download, tags: ['save', 'get'] },
    { name: 'Upload', icon: Upload, tags: ['send', 'put'] },
    { name: 'Share', icon: Share, tags: ['send', 'social'] },
    { name: 'Eye', icon: Eye, tags: ['view', 'see'] },
    { name: 'ExternalLink', icon: ExternalLink, tags: ['out', 'go'] },
    { name: 'Power', icon: Power, tags: ['on', 'off'] },
    { name: 'LogOut', icon: PowerOff, tags: ['exit', 'leave'] },
];

// Color options for projects
export const COLOR_OPTIONS = [
    { name: 'blue', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', accent: 'bg-blue-500', ring: 'ring-blue-500', fill: 'fill-blue-100 dark:fill-blue-900/30' },
    { name: 'purple', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', accent: 'bg-purple-500', ring: 'ring-purple-500', fill: 'fill-purple-100 dark:fill-purple-900/30' },
    { name: 'green', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', accent: 'bg-green-500', ring: 'ring-green-500', fill: 'fill-green-100 dark:fill-green-900/30' },
    { name: 'orange', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', accent: 'bg-orange-500', ring: 'ring-orange-500', fill: 'fill-orange-100 dark:fill-orange-900/30' },
    { name: 'pink', bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-600 dark:text-pink-400', accent: 'bg-pink-500', ring: 'ring-pink-500', fill: 'fill-pink-100 dark:fill-pink-900/30' },
    { name: 'cyan', bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-600 dark:text-cyan-400', accent: 'bg-cyan-500', ring: 'ring-cyan-500', fill: 'fill-cyan-100 dark:fill-cyan-900/30' },
    { name: 'amber', bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400', accent: 'bg-amber-500', ring: 'ring-amber-500', fill: 'fill-amber-100 dark:fill-amber-900/30' },
    { name: 'rose', bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-600 dark:text-rose-400', accent: 'bg-rose-500', ring: 'ring-rose-500', fill: 'fill-rose-100 dark:fill-rose-900/30' },
    { name: 'indigo', bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-600 dark:text-indigo-400', accent: 'bg-indigo-500', ring: 'ring-indigo-500', fill: 'fill-indigo-100 dark:fill-indigo-900/30' },
    { name: 'teal', bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-600 dark:text-teal-400', accent: 'bg-teal-500', ring: 'ring-teal-500', fill: 'fill-teal-100 dark:fill-teal-900/30' },
    { name: 'red', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', accent: 'bg-red-500', ring: 'ring-red-500', fill: 'fill-red-100 dark:fill-red-900/30' },
    { name: 'slate', bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400', accent: 'bg-slate-500', ring: 'ring-slate-500', fill: 'fill-slate-100 dark:fill-slate-800' },
];

export const getIconComponent = (iconName: string) => {
    const found = ICON_OPTIONS.find(o => o.name === iconName);
    return found?.icon || Folder;
};

export const getColorClasses = (colorName: string) => {
    const found = COLOR_OPTIONS.find(o => o.name === colorName);
    return found || COLOR_OPTIONS[0];
};
