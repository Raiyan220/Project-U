import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdateProfilePictureSchema = z.object({
    profilePicture: z.string().min(1, 'Profile picture is required'),
});

export class UpdateProfilePictureDto extends createZodDto(UpdateProfilePictureSchema) { }
