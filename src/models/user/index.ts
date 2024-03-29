import { model, Schema } from 'mongoose';
import { sign, verify, JwtPayload } from 'jsonwebtoken';
import { compare, hash } from 'bcryptjs';
import config from '../../app/config';
import { IUser, IUserDocument, IUserModel } from './type';

const jwtSecret = config('JWT_SECRET');

const schema = new Schema<IUserDocument>(
  {
    firstname: String,
    middlename: {
      type: String,
      default: '',
    },
    lastname: String,
    age: Number,
    username: {
      type: String,
      unique: true,
    },
    email: {
      type: String,
      unique: true,
    },
    password: String,
    avatar: Buffer,
    verificationToken: String,
    authTokens: [{ authToken: String }],
  },
  { timestamps: true }
);

schema.methods.toJSON = function (): Record<string, any> {
  const { _id, firstname, middlename, lastname, age, username, email } = this;

  return { _id, firstname, middlename, lastname, age, username, email };
};

schema.methods.getAuthToken = async function (): Promise<string> {
  const authToken = sign(
    {
      _id: this._id.toString(),
    },
    jwtSecret,
    { expiresIn: '1w' }
  );

  this.authTokens.push({ authToken });

  await this.save();

  return authToken;
};

schema.methods.getVerificationToken = async function (): Promise<string> {
  const token = sign(
    {
      _id: this._id.toString(),
    },
    jwtSecret,
    { expiresIn: '1h' }
  );

  this.verificationToken = token;

  await this.save();

  return token;
};

schema.statics.findByCredentials = async (
  email: string,
  password: string
): Promise<IUserDocument> => {
  const user = await User.findOne({ email });
  const err = new Error("'email' or 'password' is incorrect");

  if (!user) {
    throw err;
  }

  const isValidPassword = await compare(password, user.password);

  if (!isValidPassword) {
    throw err;
  }

  return user;
};

schema.statics.verifyUser = async (verificationToken): Promise<void> => {
  const { _id } = verify(verificationToken, jwtSecret) as JwtPayload;

  const user = await User.findOne({ _id, verificationToken });

  if (!user) {
    throw new Error('verification token is not valid');
  }

  user.verificationToken = undefined;

  await user.save();
};

schema.pre('save', async function (): Promise<void> {
  if (this.isModified('password')) {
    this.password = await hash(this.password, 8);
  }
});

const User = model<IUser, IUserModel>('User', schema);

export default User;
