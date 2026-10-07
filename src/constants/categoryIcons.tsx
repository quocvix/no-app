// src/constants/categoryIcons.tsx
import React from 'react';
import {
  Utensils,
  Coffee,
  Beer,
  Pizza,
  Apple,
  Bike,
  Car,
  Bus,
  Fuel,
  Plane,
  ShoppingBag,
  ShoppingCart,
  Shirt,
  Gift,
  Home as HomeIcon,
  Zap,
  Wifi,
  Droplets,
  Phone,
  HeartPulse,
  Pill,
  Dumbbell,
  GraduationCap,
  Film,
  Gamepad2,
  BookOpen,
  Banknote,
  Coins,
  Briefcase,
  TrendingUp,
  Wallet,
  Tag,
  Sparkles,
  HandCoins,
  MoreHorizontal,
} from 'lucide-react-native';

export interface CategoryIconOption {
  name: string;
  label: string;
  categoryGroup: string;
}

export const AVAILABLE_CATEGORY_ICONS: CategoryIconOption[] = [
  // Ẩm thực
  { name: 'Utensils', label: 'Ăn uống', categoryGroup: 'Ẩm thực' },
  { name: 'Coffee', label: 'Cà phê', categoryGroup: 'Ẩm thực' },
  { name: 'Pizza', label: 'Thức ăn nhanh', categoryGroup: 'Ẩm thực' },
  { name: 'Beer', label: 'Gặp gỡ/Nhậu', categoryGroup: 'Ẩm thực' },
  { name: 'Apple', label: 'Trái cây/Chợ', categoryGroup: 'Ẩm thực' },

  // Đi lại & Xe cộ
  { name: 'Bike', label: 'Xe máy', categoryGroup: 'Đi lại' },
  { name: 'Car', label: 'Ô tô/Taxi', categoryGroup: 'Đi lại' },
  { name: 'Bus', label: 'Xe buýt/Tàu', categoryGroup: 'Đi lại' },
  { name: 'Fuel', label: 'Xăng dầu', categoryGroup: 'Đi lại' },
  { name: 'Plane', label: 'Máy bay/Du lịch', categoryGroup: 'Đi lại' },

  // Mua sắm
  { name: 'ShoppingBag', label: 'Mua sắm', categoryGroup: 'Mua sắm' },
  { name: 'ShoppingCart', label: 'Siêu thị', categoryGroup: 'Mua sắm' },
  { name: 'Shirt', label: 'Quần áo', categoryGroup: 'Mua sắm' },
  { name: 'Gift', label: 'Quà tặng', categoryGroup: 'Mua sắm' },

  // Nhà cửa & Sinh hoạt
  { name: 'Home', label: 'Nhà cửa/Tiền trọ', categoryGroup: 'Sinh hoạt' },
  { name: 'Zap', label: 'Tiền điện', categoryGroup: 'Sinh hoạt' },
  { name: 'Droplets', label: 'Tiền nước', categoryGroup: 'Sinh hoạt' },
  { name: 'Wifi', label: 'Internet/Mạng', categoryGroup: 'Sinh hoạt' },
  { name: 'Phone', label: 'Điện thoại/4G', categoryGroup: 'Sinh hoạt' },

  // Sức khỏe & Thể thao
  { name: 'HeartPulse', label: 'Y tế/Khám bệnh', categoryGroup: 'Sức khỏe' },
  { name: 'Pill', label: 'Thuốc men', categoryGroup: 'Sức khỏe' },
  { name: 'Dumbbell', label: 'Tập gym/Thể thao', categoryGroup: 'Sức khỏe' },

  // Học tập & Giải trí
  { name: 'GraduationCap', label: 'Học tập/Khóa học', categoryGroup: 'Học tập & Giải trí' },
  { name: 'BookOpen', label: 'Sách vở', categoryGroup: 'Học tập & Giải trí' },
  { name: 'Film', label: 'Xem phim', categoryGroup: 'Học tập & Giải trí' },
  { name: 'Gamepad2', label: 'Trò chơi/Game', categoryGroup: 'Học tập & Giải trí' },

  // Thu nhập & Tài chính
  { name: 'Banknote', label: 'Lương', categoryGroup: 'Tài chính' },
  { name: 'Coins', label: 'Tiền thưởng', categoryGroup: 'Tài chính' },
  { name: 'Briefcase', label: 'Kinh doanh/Dự án', categoryGroup: 'Tài chính' },
  { name: 'TrendingUp', label: 'Đầu tư/Lãi', categoryGroup: 'Tài chính' },
  { name: 'Wallet', label: 'Ví tiền/Phụ cấp', categoryGroup: 'Tài chính' },

  // Khác
  { name: 'Tag', label: 'Nhãn/Khác', categoryGroup: 'Khác' },
  { name: 'Sparkles', label: 'Làm đẹp/Spa', categoryGroup: 'Khác' },
  { name: 'HandCoins', label: 'Sổ nợ (Hệ thống)', categoryGroup: 'Khác' },
  { name: 'MoreHorizontal', label: 'Khác', categoryGroup: 'Khác' },
];

export const renderCategoryIcon = (
  iconName: string,
  size = 18,
  color = '#64748B'
): React.ReactElement => {
  switch (iconName) {
    case 'Utensils':
      return <Utensils size={size} color={color} />;
    case 'Coffee':
      return <Coffee size={size} color={color} />;
    case 'Pizza':
      return <Pizza size={size} color={color} />;
    case 'Beer':
      return <Beer size={size} color={color} />;
    case 'Apple':
      return <Apple size={size} color={color} />;
    case 'Bike':
      return <Bike size={size} color={color} />;
    case 'Car':
      return <Car size={size} color={color} />;
    case 'Bus':
      return <Bus size={size} color={color} />;
    case 'Fuel':
      return <Fuel size={size} color={color} />;
    case 'Plane':
      return <Plane size={size} color={color} />;
    case 'ShoppingBag':
      return <ShoppingBag size={size} color={color} />;
    case 'ShoppingCart':
      return <ShoppingCart size={size} color={color} />;
    case 'Shirt':
      return <Shirt size={size} color={color} />;
    case 'Gift':
      return <Gift size={size} color={color} />;
    case 'Home':
      return <HomeIcon size={size} color={color} />;
    case 'Zap':
      return <Zap size={size} color={color} />;
    case 'Droplets':
      return <Droplets size={size} color={color} />;
    case 'Wifi':
      return <Wifi size={size} color={color} />;
    case 'Phone':
      return <Phone size={size} color={color} />;
    case 'HeartPulse':
      return <HeartPulse size={size} color={color} />;
    case 'Pill':
      return <Pill size={size} color={color} />;
    case 'Dumbbell':
      return <Dumbbell size={size} color={color} />;
    case 'GraduationCap':
      return <GraduationCap size={size} color={color} />;
    case 'BookOpen':
      return <BookOpen size={size} color={color} />;
    case 'Film':
      return <Film size={size} color={color} />;
    case 'Gamepad2':
      return <Gamepad2 size={size} color={color} />;
    case 'Banknote':
      return <Banknote size={size} color={color} />;
    case 'Coins':
      return <Coins size={size} color={color} />;
    case 'Briefcase':
      return <Briefcase size={size} color={color} />;
    case 'TrendingUp':
      return <TrendingUp size={size} color={color} />;
    case 'Wallet':
      return <Wallet size={size} color={color} />;
    case 'Tag':
      return <Tag size={size} color={color} />;
    case 'Sparkles':
      return <Sparkles size={size} color={color} />;
    case 'HandCoins':
      return <HandCoins size={size} color={color} />;
    default:
      return <MoreHorizontal size={size} color={color} />;
  }
};
