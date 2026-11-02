import {
  IconArrowLeft,
  IconCheck,
  IconChevronRight,
  IconDots,
  IconDroplet,
  IconEye,
  IconEyeOff,
  IconLink,
  IconPlus,
  IconSearch,
  IconTemperature,
  IconX,
} from "@tabler/icons-react";

const icons = {
  back: IconArrowLeft,
  check: IconCheck,
  chevron: IconChevronRight,
  more: IconDots,
  water: IconDroplet,
  eye: IconEye,
  hidden: IconEyeOff,
  link: IconLink,
  plus: IconPlus,
  search: IconSearch,
  temperature: IconTemperature,
  close: IconX,
};

export function ConnectionIcon({ name }: { name: keyof typeof icons }) {
  const Icon = icons[name];
  return <Icon size={19} stroke={1.75} aria-hidden="true" />;
}
